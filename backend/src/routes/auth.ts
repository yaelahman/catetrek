import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { randomBytes } from "crypto";
import { prisma } from "../utils/prisma";
import { signToken } from "../utils/jwt";
import { ok, fail } from "../utils/response";
import { logActivity } from "../utils/activity";
import { requireAuth } from "../middleware/auth";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Terlalu banyak percobaan login" },
});

const defaultCategories = [
  { name: "Penjualan", type: "INCOME" as const, color: "#059669", icon: "store" },
  { name: "Pendapatan Lain", type: "INCOME" as const, color: "#10B981", icon: "plus" },
  { name: "Pembelian Stok", type: "EXPENSE" as const, color: "#DC2626", icon: "box" },
  { name: "Operasional", type: "EXPENSE" as const, color: "#EA580C", icon: "settings" },
  { name: "Gaji Karyawan", type: "EXPENSE" as const, color: "#D97706", icon: "users" },
  { name: "Sewa & Utilitas", type: "EXPENSE" as const, color: "#7C3AED", icon: "home" },
  { name: "Pemasaran", type: "EXPENSE" as const, color: "#2563EB", icon: "megaphone" },
  { name: "Transportasi", type: "EXPENSE" as const, color: "#0891B2", icon: "truck" },
  { name: "Pajak", type: "EXPENSE" as const, color: "#4B5563", icon: "receipt" },
];

router.post("/register", async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8),
      businessName: z.string().min(2),
    });
    const body = schema.parse(req.body);

    const exists = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (exists) return fail(res, "Email sudah terdaftar", 409);

    const passwordHash = await bcrypt.hash(body.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: body.name,
          email: body.email.toLowerCase(),
          passwordHash,
        },
      });

      const business = await tx.business.create({
        data: { name: body.businessName },
      });

      await tx.membership.create({
        data: { userId: user.id, businessId: business.id, role: "OWNER" },
      });

      await tx.account.create({
        data: {
          name: "Kas Tunai",
          type: "CASH",
          color: "#0F766E",
          openingBalance: 0,
          businessId: business.id,
        },
      });

      await tx.category.createMany({
        data: defaultCategories.map((c) => ({
          ...c,
          businessId: business.id,
          userId: user.id,
        })),
      });

      return { user, business };
    });

    const token = signToken({ userId: result.user.id, email: result.user.email });
    await logActivity("REGISTER", `User ${result.user.email} registered`, result.user.id, result.business.id);

    return ok(
      res,
      {
        token,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
        business: result.business,
      },
      201
    );
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    console.error(err);
    return fail(res, "Gagal registrasi", 500);
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    });
    const body = schema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: {
        memberships: { include: { business: true } },
      },
    });

    if (!user) return fail(res, "Email atau password salah", 401);
    if (user.deletedAt) return fail(res, "Akun telah dihapus. Hubungi admin untuk memulihkan.", 403);
    if (!user.isActive) return fail(res, "Akun dinonaktifkan. Hubungi admin.", 403);

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) return fail(res, "Email atau password salah", 401);

    const token = signToken({ userId: user.id, email: user.email });
    await logActivity("LOGIN", `Login berhasil`, user.id);

    return ok(res, {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isSuperAdmin: user.isSuperAdmin,
      },
      businesses: user.memberships.map((m) => ({
        ...m.business,
        role: m.role,
      })),
    });
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal login", 500);
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: {
      memberships: { include: { business: true } },
    },
  });
  if (!user) return fail(res, "User tidak ditemukan", 404);

  return ok(res, {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    isSuperAdmin: user.isSuperAdmin,
    businesses: user.memberships.map((m) => ({
      ...m.business,
      role: m.role,
    })),
  });
});

router.patch("/profile", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2).optional(),
      avatarUrl: z.string().nullable().optional(),
    });
    const body = schema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: body,
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    return ok(res, user);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal update profil", 500);
  }
});

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    });
    const body = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return fail(res, "User tidak ditemukan", 404);

    const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!valid) return fail(res, "Password saat ini salah", 400);

    const passwordHash = await bcrypt.hash(body.newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await logActivity("CHANGE_PASSWORD", "Password diubah", user.id);

    return ok(res, { message: "Password berhasil diubah" });
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal ubah password", 500);
  }
});

router.post("/forgot-password", loginLimiter, async (req, res) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const body = schema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });

    // Always return success to avoid email enumeration
    if (!user) {
      return ok(res, { message: "Jika email terdaftar, token reset telah dibuat", token: null });
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    // In production, send via email. For local/dev we return the token.
    return ok(res, {
      message: "Token reset password dibuat (kirim via email di production)",
      token,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal request reset", 500);
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const schema = z.object({
      token: z.string().min(10),
      newPassword: z.string().min(8),
    });
    const body = schema.parse(req.body);

    const record = await prisma.passwordResetToken.findUnique({ where: { token: body.token } });
    if (!record || record.used || record.expiresAt < new Date()) {
      return fail(res, "Token tidak valid atau kadaluarsa", 400);
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
    ]);

    await logActivity("RESET_PASSWORD", "Password direset via token", record.userId);
    return ok(res, { message: "Password berhasil direset" });
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal reset password", 500);
  }
});

export default router;
