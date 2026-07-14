import { Router } from "express";
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
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isSuperAdmin: true } }),
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
  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      isSuperAdmin: true,
      isActive: true,
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
    });
    const body = schema.parse(req.body);
    const id = String(req.params.id);

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return fail(res, "User tidak ditemukan", 404);

    if (id === req.user!.id) {
      if (body.isActive === false) return fail(res, "Tidak bisa menonaktifkan akun sendiri", 400);
      if (body.isSuperAdmin === false) return fail(res, "Tidak bisa mencabut superadmin diri sendiri", 400);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        isActive: body.isActive,
        isSuperAdmin: body.isSuperAdmin,
        name: body.name,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isSuperAdmin: true,
        isActive: true,
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

export default router;
