import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../utils/prisma";
import { ok, fail } from "../utils/response";
import { requireAuth, requireBusiness, requireRoles } from "../middleware/auth";
import { emitBusiness } from "../socket";
import { logActivity } from "../utils/activity";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const memberships = await prisma.membership.findMany({
    where: { userId: req.user!.id },
    include: { business: true },
  });
  return ok(
    res,
    memberships.map((m) => ({ ...m.business, role: m.role }))
  );
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      currency: z.string().default("IDR"),
    });
    const body = schema.parse(req.body);

    const business = await prisma.$transaction(async (tx) => {
      const b = await tx.business.create({
        data: { name: body.name, currency: body.currency },
      });
      await tx.membership.create({
        data: { userId: req.user!.id, businessId: b.id, role: "OWNER" },
      });
      await tx.account.create({
        data: { name: "Kas Tunai", type: "CASH", businessId: b.id },
      });
      return b;
    });

    await logActivity("BUSINESS_CREATE", business.name, req.user!.id, business.id);
    return ok(res, { ...business, role: "OWNER" }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal membuat bisnis", 500);
  }
});

router.patch("/:id", requireAuth, requireBusiness, requireRoles("OWNER", "ADMIN"), async (req, res) => {
  try {
    if (req.params.id !== req.businessId) return fail(res, "Business ID tidak cocok", 400);

    const schema = z.object({
      name: z.string().min(2).optional(),
      currency: z.string().optional(),
      timezone: z.string().optional(),
    });
    const body = schema.parse(req.body);

    const business = await prisma.business.update({
      where: { id: req.businessId },
      data: body,
    });

    emitBusiness(req.businessId!, "business:changed", { action: "update", business });
    return ok(res, business);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal update bisnis", 500);
  }
});

router.get("/:id/members", requireAuth, requireBusiness, async (req, res) => {
  if (req.params.id !== req.businessId) return fail(res, "Business ID tidak cocok", 400);

  const members = await prisma.membership.findMany({
    where: { businessId: req.businessId },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return ok(res, members);
});

router.post("/:id/members", requireAuth, requireBusiness, requireRoles("OWNER", "ADMIN"), async (req, res) => {
  try {
    if (req.params.id !== req.businessId) return fail(res, "Business ID tidak cocok", 400);

    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(2).optional(),
      password: z.string().min(8).optional(),
      role: z.enum(["ADMIN", "STAFF"]).default("STAFF"),
    });
    const body = schema.parse(req.body);

    let user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });

    if (!user) {
      if (!body.name || !body.password) {
        return fail(res, "User baru membutuhkan name dan password", 400);
      }
      user = await prisma.user.create({
        data: {
          name: body.name,
          email: body.email.toLowerCase(),
          passwordHash: await bcrypt.hash(body.password, 12),
        },
      });
    }

    const existing = await prisma.membership.findUnique({
      where: { userId_businessId: { userId: user.id, businessId: req.businessId! } },
    });
    if (existing) return fail(res, "User sudah menjadi anggota", 409);

    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        businessId: req.businessId!,
        role: body.role,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    emitBusiness(req.businessId!, "member:changed", { action: "create", membership });
    return ok(res, membership, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal menambah anggota", 500);
  }
});

router.patch("/:id/members/:memberId", requireAuth, requireBusiness, requireRoles("OWNER"), async (req, res) => {
  try {
    const schema = z.object({ role: z.enum(["ADMIN", "STAFF", "OWNER"]) });
    const body = schema.parse(req.body);

    const membership = await prisma.membership.findFirst({
      where: { id: String(req.params.memberId), businessId: req.businessId },
    });
    if (!membership) return fail(res, "Anggota tidak ditemukan", 404);

    const updated = await prisma.membership.update({
      where: { id: membership.id },
      data: { role: body.role },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    emitBusiness(req.businessId!, "member:changed", { action: "update", membership: updated });
    return ok(res, updated);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal update anggota", 500);
  }
});

router.delete("/:id/members/:memberId", requireAuth, requireBusiness, requireRoles("OWNER", "ADMIN"), async (req, res) => {
  const membership = await prisma.membership.findFirst({
    where: { id: String(req.params.memberId), businessId: req.businessId },
  });
  if (!membership) return fail(res, "Anggota tidak ditemukan", 404);
  if (membership.role === "OWNER") return fail(res, "Owner tidak bisa dihapus", 400);

  await prisma.membership.delete({ where: { id: membership.id } });
  emitBusiness(req.businessId!, "member:changed", { action: "delete", id: membership.id });
  return ok(res, { message: "Anggota dihapus" });
});

export default router;
