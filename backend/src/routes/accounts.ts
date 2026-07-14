import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { ok, fail } from "../utils/response";
import { requireAuth, requireBusiness, requireRoles } from "../middleware/auth";
import { emitBusiness } from "../socket";
import { logActivity } from "../utils/activity";

const router = Router();

router.use(requireAuth, requireBusiness);

router.get("/", async (req, res) => {
  const accounts = await prisma.account.findMany({
    where: { businessId: req.businessId },
    orderBy: { createdAt: "asc" },
  });

  const balances = await Promise.all(
    accounts.map(async (account) => {
      const income = await prisma.transaction.aggregate({
        where: { businessId: req.businessId, accountId: account.id, type: "INCOME", deletedAt: null },
        _sum: { amount: true },
      });
      const expense = await prisma.transaction.aggregate({
        where: { businessId: req.businessId, accountId: account.id, type: "EXPENSE", deletedAt: null },
        _sum: { amount: true },
      });
      const transferIn = await prisma.transaction.aggregate({
        where: {
          businessId: req.businessId,
          transferToId: account.id,
          type: "TRANSFER",
          deletedAt: null,
        },
        _sum: { amount: true },
      });
      const transferOut = await prisma.transaction.aggregate({
        where: {
          businessId: req.businessId,
          transferFromId: account.id,
          type: "TRANSFER",
          deletedAt: null,
        },
        _sum: { amount: true },
      });

      const balance =
        Number(account.openingBalance) +
        Number(income._sum.amount || 0) -
        Number(expense._sum.amount || 0) +
        Number(transferIn._sum.amount || 0) -
        Number(transferOut._sum.amount || 0);

      return {
        ...account,
        openingBalance: Number(account.openingBalance),
        balance: Math.round(balance * 100) / 100,
      };
    })
  );

  return ok(res, balances);
});

router.post("/", requireRoles("OWNER", "ADMIN", "STAFF"), async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      type: z.enum(["CASH", "BANK", "EWALLET", "CREDIT", "OTHER"]).default("CASH"),
      color: z.string().optional(),
      openingBalance: z.number().default(0),
    });
    const body = schema.parse(req.body);

    const account = await prisma.account.create({
      data: { ...body, businessId: req.businessId! },
    });

    await logActivity("ACCOUNT_CREATE", account.name, req.user!.id, req.businessId);
    emitBusiness(req.businessId!, "account:changed", { action: "create", account });
    return ok(res, { ...account, balance: account.openingBalance }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal membuat akun", 500);
  }
});

router.patch("/:id", requireRoles("OWNER", "ADMIN"), async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      type: z.enum(["CASH", "BANK", "EWALLET", "CREDIT", "OTHER"]).optional(),
      color: z.string().optional(),
      openingBalance: z.number().optional(),
      isActive: z.boolean().optional(),
    });
    const body = schema.parse(req.body);

    const existing = await prisma.account.findFirst({
      where: { id: String(req.params.id), businessId: req.businessId },
    });
    if (!existing) return fail(res, "Akun tidak ditemukan", 404);

    const account = await prisma.account.update({
      where: { id: existing.id },
      data: {
        ...body,
        openingBalance:
          body.openingBalance !== undefined ? Math.round(body.openingBalance * 100) / 100 : undefined,
      },
    });

    emitBusiness(req.businessId!, "account:changed", { action: "update", account });
    return ok(res, {
      ...account,
      openingBalance: Number(account.openingBalance),
    });
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal update akun", 500);
  }
});

router.delete("/:id", requireRoles("OWNER", "ADMIN"), async (req, res) => {
  const existing = await prisma.account.findFirst({
    where: { id: String(req.params.id), businessId: req.businessId },
  });
  if (!existing) return fail(res, "Akun tidak ditemukan", 404);

  const count = await prisma.transaction.count({
    where: {
      deletedAt: null,
      OR: [
        { accountId: existing.id },
        { transferFromId: existing.id },
        { transferToId: existing.id },
      ],
    },
  });

  if (count > 0) {
    const account = await prisma.account.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    emitBusiness(req.businessId!, "account:changed", { action: "deactivate", account });
    return ok(res, { message: "Akun dinonaktifkan karena masih punya transaksi", account });
  }

  await prisma.account.delete({ where: { id: existing.id } });
  emitBusiness(req.businessId!, "account:changed", { action: "delete", id: existing.id });
  return ok(res, { message: "Akun dihapus" });
});

export default router;
