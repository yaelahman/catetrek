import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { ok, fail } from "../utils/response";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";
import { logActivity } from "../utils/activity";

const router = Router();
router.use(requireAuth, requireSuperAdmin);

router.get("/overview", async (_req, res) => {
  const [
    usersTotal,
    usersActive,
    usersSuper,
    businessesTotal,
    membershipsTotal,
    transactionsTotal,
    debtsOpen,
    savingsActive,
    recentUsers,
    recentBusinesses,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { isActive: true, deletedAt: null } }),
    prisma.user.count({ where: { isSuperAdmin: true, deletedAt: null } }),
    prisma.business.count(),
    prisma.membership.count(),
    prisma.transaction.count({ where: { deletedAt: null } }),
    prisma.debt.count({
      where: { deletedAt: null, status: { in: ["UNPAID", "PARTIAL"] } },
    }),
    prisma.savingsGoal.count({ where: { status: "ACTIVE" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        isSuperAdmin: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.business.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        _count: { select: { memberships: true, transactions: true } },
      },
    }),
  ]);

  return ok(res, {
    stats: {
      usersTotal,
      usersActive,
      usersInactive: usersTotal - usersActive,
      usersSuper,
      businessesTotal,
      membershipsTotal,
      transactionsTotal,
      debtsOpen,
      savingsActive,
    },
    recentUsers,
    recentBusinesses,
  });
});

router.get("/users", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const includeDeleted = String(req.query.includeDeleted || "") === "1";
  const users = await prisma.user.findMany({
    where: {
      ...(includeDeleted ? {} : { deletedAt: null }),
      ...(q
        ? {
            OR: [{ name: { contains: q } }, { email: { contains: q } }],
          }
        : {}),
    },
    orderBy: [{ deletedAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      isSuperAdmin: true,
      isActive: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      memberships: {
        include: {
          business: { select: { id: true, name: true } },
        },
      },
      _count: { select: { transactions: true, activityLogs: true } },
    },
  });

  return ok(
    res,
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isSuperAdmin: u.isSuperAdmin,
      isActive: u.isActive,
      deletedAt: u.deletedAt,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      businesses: u.memberships.map((m) => ({
        id: m.business.id,
        name: m.business.name,
        role: m.role,
      })),
      transactionCount: u._count.transactions,
      activityCount: u._count.activityLogs,
    }))
  );
});

router.patch("/users/:id", async (req, res) => {
  try {
    const schema = z.object({
      isActive: z.boolean().optional(),
      isSuperAdmin: z.boolean().optional(),
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
    });
    const body = schema.parse(req.body);
    const id = String(req.params.id);

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return fail(res, "User tidak ditemukan", 404);
    if (target.deletedAt) return fail(res, "User sudah diarsipkan. Pulihkan dulu sebelum mengedit.", 400);

    if (id === req.user!.id) {
      if (body.isActive === false) return fail(res, "Tidak bisa menonaktifkan akun sendiri", 400);
      if (body.isSuperAdmin === false) return fail(res, "Tidak bisa mencabut superadmin diri sendiri", 400);
    }

    if (body.email) {
      const email = body.email.toLowerCase();
      const clash = await prisma.user.findFirst({
        where: { email, id: { not: id }, deletedAt: null },
      });
      if (clash) return fail(res, "Email sudah dipakai pengguna lain", 400);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        isActive: body.isActive,
        isSuperAdmin: body.isSuperAdmin,
        name: body.name,
        email: body.email ? body.email.toLowerCase() : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isSuperAdmin: true,
        isActive: true,
        deletedAt: true,
        updatedAt: true,
      },
    });

    await logActivity(
      "ADMIN_USER_UPDATE",
      `${updated.email} active=${updated.isActive} super=${updated.isSuperAdmin}`,
      req.user!.id
    );

    return ok(res, updated);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal update user", 500);
  }
});

/** Superadmin set password pengguna (tanpa password lama). */
router.post("/users/:id/password", async (req, res) => {
  try {
    const schema = z
      .object({
        newPassword: z.string().min(8),
        confirmPassword: z.string().min(8),
      })
      .refine((d) => d.newPassword === d.confirmPassword, {
        message: "Konfirmasi password tidak cocok",
        path: ["confirmPassword"],
      });
    const body = schema.parse(req.body);
    const id = String(req.params.id);

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return fail(res, "User tidak ditemukan", 404);
    if (target.deletedAt) return fail(res, "User sudah diarsipkan. Pulihkan dulu sebelum ubah password.", 400);

    const passwordHash = await bcrypt.hash(body.newPassword, 12);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
    await logActivity("ADMIN_USER_PASSWORD", target.email, req.user!.id);

    return ok(res, { message: "Password berhasil diubah" });
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal ubah password", 500);
  }
});

/** Soft-delete user (arsip). */
router.delete("/users/:id", async (req, res) => {
  const id = String(req.params.id);
  if (id === req.user!.id) return fail(res, "Tidak bisa mengarsipkan akun sendiri", 400);

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return fail(res, "User tidak ditemukan", 404);
  if (target.deletedAt) return fail(res, "User sudah diarsipkan", 400);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      isActive: false,
    },
    select: {
      id: true,
      name: true,
      email: true,
      deletedAt: true,
      isActive: true,
    },
  });

  await logActivity("ADMIN_USER_SOFT_DELETE", updated.email, req.user!.id);
  return ok(res, updated);
});

/** Restore soft-deleted user. */
router.post("/users/:id/restore", async (req, res) => {
  const id = String(req.params.id);
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return fail(res, "User tidak ditemukan", 404);
  if (!target.deletedAt) return fail(res, "User tidak dalam arsip", 400);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      deletedAt: true,
      isActive: true,
      isSuperAdmin: true,
    },
  });

  await logActivity("ADMIN_USER_RESTORE", updated.email, req.user!.id);
  return ok(res, updated);
});

router.get("/businesses", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const businesses = await prisma.business.findMany({
    where: q ? { name: { contains: q } } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      memberships: {
        include: {
          user: { select: { id: true, name: true, email: true, isActive: true } },
        },
      },
      _count: {
        select: {
          accounts: true,
          transactions: true,
          categories: true,
          debts: true,
          savingsGoals: true,
        },
      },
    },
  });

  return ok(
    res,
    businesses.map((b) => ({
      id: b.id,
      name: b.name,
      currency: b.currency,
      timezone: b.timezone,
      createdAt: b.createdAt,
      members: b.memberships.map((m) => ({
        role: m.role,
        user: m.user,
      })),
      counts: b._count,
    }))
  );
});

router.get("/activity", async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "40"), 10) || 40));
  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, name: true, email: true } },
      business: { select: { id: true, name: true } },
    },
  });
  return ok(res, logs);
});

/** Analytics pengguna platform. */
router.get("/analytics", async (_req, res) => {
  const days = 30;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const [
    usersTotal,
    usersActive,
    usersInactive,
    usersArchived,
    usersSuper,
    businessesTotal,
    transactionsTotal,
    recentUsers,
    signupRows,
    topTxUsers,
    recentActivity,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { isActive: true, deletedAt: null } }),
    prisma.user.count({ where: { isActive: false, deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: { not: null } } }),
    prisma.user.count({ where: { isSuperAdmin: true, deletedAt: null } }),
    prisma.business.count(),
    prisma.transaction.count({ where: { deletedAt: null } }),
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        isSuperAdmin: true,
        createdAt: true,
        _count: { select: { memberships: true, transactions: true } },
      },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        _count: { select: { transactions: true, activityLogs: true } },
      },
      orderBy: { transactions: { _count: "desc" } },
      take: 10,
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { id: true, name: true, email: true } },
        business: { select: { id: true, name: true } },
      },
    }),
  ]);

  const dayKeys: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const signupMap = new Map(dayKeys.map((k) => [k, 0]));
  for (const row of signupRows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    if (signupMap.has(key)) signupMap.set(key, (signupMap.get(key) || 0) + 1);
  }
  const signupsByDay = dayKeys.map((date) => ({ date, count: signupMap.get(date) || 0 }));

  const signupsLast7 = signupsByDay.slice(-7).reduce((s, x) => s + x.count, 0);
  const signupsPrev7 = signupsByDay.slice(-14, -7).reduce((s, x) => s + x.count, 0);

  return ok(res, {
    summary: {
      usersTotal,
      usersActive,
      usersInactive,
      usersArchived,
      usersSuper,
      businessesTotal,
      transactionsTotal,
      signupsLast7,
      signupsPrev7,
      signupsDelta: signupsLast7 - signupsPrev7,
    },
    statusBreakdown: {
      active: usersActive,
      inactive: usersInactive,
      archived: usersArchived,
      superadmin: usersSuper,
    },
    signupsByDay,
    recentUsers: recentUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isActive: u.isActive,
      isSuperAdmin: u.isSuperAdmin,
      createdAt: u.createdAt,
      businessCount: u._count.memberships,
      transactionCount: u._count.transactions,
    })),
    topUsers: topTxUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isActive: u.isActive,
      transactionCount: u._count.transactions,
      activityCount: u._count.activityLogs,
    })),
    recentActivity,
  });
});

export default router;
