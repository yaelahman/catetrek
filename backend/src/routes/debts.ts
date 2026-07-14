import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { ok, fail } from "../utils/response";
import { requireAuth, requireBusiness, requireRoles } from "../middleware/auth";
import { emitBusiness } from "../socket";
import { money } from "../utils/money";
import { logActivity } from "../utils/activity";

const router = Router();
router.use(requireAuth, requireBusiness);

function computeStatus(amount: number, paidAmount: number) {
  if (paidAmount <= 0) return "UNPAID" as const;
  if (paidAmount >= amount - 0.01) return "PAID" as const;
  return "PARTIAL" as const;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function installmentAmount(total: number, count: number, indexZeroBased: number) {
  if (count <= 1) return money(total);
  const base = money(Math.floor((total / count) * 100) / 100);
  if (indexZeroBased < count - 1) return base;
  return money(total - base * (count - 1));
}

function enrichDebt(debt: {
  amount: unknown;
  paidAmount: unknown;
  installmentCount: number;
  installmentPaid: number;
  startDate: Date | null;
  dueDate: Date | null;
  [key: string]: unknown;
}) {
  const amount = money(debt.amount);
  const paidAmount = money(debt.paidAmount);
  const count = Math.max(1, debt.installmentCount || 1);
  const paid = Math.min(count, Math.max(0, debt.installmentPaid || 0));
  const remainingInstallments = Math.max(0, count - paid);
  const isInstallment = count > 1;
  const anchor = debt.startDate || debt.dueDate;
  const nextDueDate =
    isInstallment && remainingInstallments > 0 && anchor ? addMonths(anchor, paid) : debt.dueDate;
  const endDate = isInstallment && anchor ? addMonths(anchor, count - 1) : debt.dueDate;
  const nextInstallmentAmount =
    remainingInstallments > 0 ? installmentAmount(amount, count, paid) : 0;

  return {
    ...debt,
    amount,
    paidAmount,
    installmentCount: count,
    installmentPaid: paid,
    remainingInstallments,
    isInstallment,
    installmentAmount: installmentAmount(amount, count, 0),
    nextInstallmentAmount,
    nextDueDate,
    endDate,
  };
}

async function ensureDebtCategory(
  businessId: string,
  userId: string,
  type: "INCOME" | "EXPENSE",
  name: string
) {
  const existing = await prisma.category.findFirst({
    where: { businessId, name, type, isActive: true },
  });
  if (existing) return existing;
  return prisma.category.create({
    data: {
      businessId,
      userId,
      name,
      type,
      color: type === "EXPENSE" ? "#C2410C" : "#047857",
      icon: "handshake",
    },
  });
}

router.get("/", async (req, res) => {
  const type = req.query.type as string | undefined;
  const status = req.query.status as string | undefined;

  const debts = await prisma.debt.findMany({
    where: {
      businessId: req.businessId,
      deletedAt: null,
      ...(type ? { type: type as "PAYABLE" | "RECEIVABLE" } : {}),
      ...(status ? { status: status as "UNPAID" | "PARTIAL" | "PAID" } : {}),
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  return ok(res, debts.map(enrichDebt));
});

router.post("/", requireRoles("OWNER", "ADMIN", "STAFF"), async (req, res) => {
  try {
    const schema = z.object({
      type: z.enum(["PAYABLE", "RECEIVABLE"]),
      partyName: z.string().min(1),
      amount: z.number().positive(),
      paidAmount: z.number().min(0).default(0),
      dueDate: z.string().nullable().optional(),
      startDate: z.string().nullable().optional(),
      installmentCount: z.number().int().min(1).max(120).default(1),
      installmentPaid: z.number().int().min(0).default(0),
      note: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const count = body.installmentCount || 1;
    let installmentPaid = Math.min(count, Math.max(0, body.installmentPaid || 0));
    let paidAmount = money(body.paidAmount || 0);
    const amount = money(body.amount);

    if (count > 1 && installmentPaid > 0 && paidAmount <= 0) {
      paidAmount = 0;
      for (let i = 0; i < installmentPaid; i++) {
        paidAmount = money(paidAmount + installmentAmount(amount, count, i));
      }
    }

    if (count > 1 && installmentPaid === 0 && paidAmount > 0) {
      let running = 0;
      for (let i = 0; i < count; i++) {
        running = money(running + installmentAmount(amount, count, i));
        if (paidAmount + 0.01 >= running) installmentPaid = i + 1;
        else break;
      }
    }

    const startRaw = body.startDate || body.dueDate || null;
    const startDate = startRaw ? new Date(startRaw) : null;
    const nextDue =
      count > 1 && startDate && installmentPaid < count
        ? addMonths(startDate, installmentPaid)
        : body.dueDate
          ? new Date(body.dueDate)
          : startDate;

    const debt = await prisma.debt.create({
      data: {
        type: body.type,
        partyName: body.partyName,
        amount,
        paidAmount,
        status: computeStatus(amount, paidAmount),
        dueDate: nextDue,
        startDate,
        installmentCount: count,
        installmentPaid,
        note: body.note,
        businessId: req.businessId!,
      },
    });

    emitBusiness(req.businessId!, "debt:changed", { action: "create", debt });
    return ok(res, enrichDebt(debt), 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal membuat hutang/piutang", 500);
  }
});

/** Bayar 1 periode (atau sisa); opsional link ke akun/transaksi. */
router.post("/:id/pay-installment", requireRoles("OWNER", "ADMIN", "STAFF"), async (req, res) => {
  try {
    const schema = z.object({
      amount: z.number().positive().optional(),
      accountId: z.string().optional(),
      linkTransaction: z.boolean().optional().default(true),
      date: z.string().optional(),
      note: z.string().optional(),
    });
    const body = schema.parse(req.body ?? {});

    if (!body.accountId) {
      return fail(res, "Akun wajib dipilih agar pembayaran tercatat di transaksi", 400);
    }

    const existing = await prisma.debt.findFirst({
      where: { id: String(req.params.id), businessId: req.businessId, deletedAt: null },
    });
    if (!existing) return fail(res, "Data tidak ditemukan", 404);
    if (existing.status === "PAID") return fail(res, "Sudah lunas", 400);

    const account = await prisma.account.findFirst({
      where: { id: body.accountId, businessId: req.businessId, isActive: true },
    });
    if (!account) return fail(res, "Akun tidak ditemukan atau nonaktif", 400);

    const amount = money(existing.amount);
    const alreadyPaid = money(existing.paidAmount);
    const count = Math.max(1, existing.installmentCount || 1);
    const paidPeriods = Math.min(count, Math.max(0, existing.installmentPaid || 0));

    if (count > 1 && paidPeriods >= count) {
      return fail(res, "Semua cicilan sudah dibayar", 400);
    }

    const dueAmount =
      count > 1
        ? installmentAmount(amount, count, paidPeriods)
        : money(amount - alreadyPaid);

    const pay = money(
      Math.min(body.amount ?? dueAmount, money(amount - alreadyPaid))
    );
    if (pay <= 0) return fail(res, "Tidak ada sisa yang perlu dibayar", 400);

    const date = body.date
      ? new Date(body.date)
      : (() => {
          const now = new Date();
          return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
        })();
    const isPayable = existing.type === "PAYABLE";
    const cat = await ensureDebtCategory(
      req.businessId!,
      req.user!.id,
      isPayable ? "EXPENSE" : "INCOME",
      isPayable ? "Pembayaran Hutang" : "Penerimaan Piutang"
    );
    const tx = await prisma.transaction.create({
      data: {
        type: isPayable ? "EXPENSE" : "INCOME",
        amount: pay,
        date,
        note:
          body.note ||
          `${isPayable ? "Bayar hutang" : "Terima piutang"}: ${existing.partyName}` +
            (count > 1 ? ` (cicilan ${paidPeriods + 1}/${count})` : ""),
        businessId: req.businessId!,
        accountId: body.accountId,
        categoryId: cat.id,
        createdById: req.user!.id,
      },
    });
    emitBusiness(req.businessId!, "transaction:changed", { action: "create", transaction: tx });

    const paidAmount = money(alreadyPaid + pay);
    let installmentPaid = count > 1 ? Math.min(count, paidPeriods + 1) : paidPeriods;
    if (paidAmount >= amount - 0.01) installmentPaid = count;
    const start = existing.startDate || existing.dueDate;
    const dueDate =
      count > 1 && start && installmentPaid < count
        ? addMonths(start, installmentPaid)
        : existing.dueDate;

    const debt = await prisma.debt.update({
      where: { id: existing.id },
      data: {
        paidAmount,
        installmentPaid,
        status: computeStatus(amount, paidAmount),
        dueDate,
      },
    });

    await logActivity(
      "DEBT_PAY",
      `${existing.partyName}: ${pay} tx=${tx.id}`,
      req.user!.id,
      req.businessId
    );

    emitBusiness(req.businessId!, "debt:changed", { action: "pay-installment", debt });
    return ok(res, { ...enrichDebt(debt), transactionId: tx.id });
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    console.error(err);
    return fail(res, "Gagal mencatat cicilan", 500);
  }
});

router.patch("/:id", requireRoles("OWNER", "ADMIN", "STAFF"), async (req, res) => {
  try {
    const schema = z.object({
      partyName: z.string().min(1).optional(),
      amount: z.number().positive().optional(),
      paidAmount: z.number().min(0).optional(),
      dueDate: z.string().nullable().optional(),
      startDate: z.string().nullable().optional(),
      installmentCount: z.number().int().min(1).max(120).optional(),
      installmentPaid: z.number().int().min(0).optional(),
      note: z.string().optional(),
      type: z.enum(["PAYABLE", "RECEIVABLE"]).optional(),
    });
    const body = schema.parse(req.body);

    const existing = await prisma.debt.findFirst({
      where: { id: String(req.params.id), businessId: req.businessId, deletedAt: null },
    });
    if (!existing) return fail(res, "Data tidak ditemukan", 404);

    const amount = money(body.amount ?? existing.amount);
    const paidAmount = money(body.paidAmount ?? existing.paidAmount);
    const installmentCount = body.installmentCount ?? existing.installmentCount;
    let installmentPaid = body.installmentPaid ?? existing.installmentPaid;
    installmentPaid = Math.min(installmentCount, Math.max(0, installmentPaid));

    const startDate =
      body.startDate === undefined
        ? existing.startDate
        : body.startDate
          ? new Date(body.startDate)
          : null;

    let dueDate =
      body.dueDate === undefined
        ? existing.dueDate
        : body.dueDate
          ? new Date(body.dueDate)
          : null;

    if (installmentCount > 1 && startDate && installmentPaid < installmentCount) {
      dueDate = addMonths(startDate, installmentPaid);
    }

    const debt = await prisma.debt.update({
      where: { id: existing.id },
      data: {
        type: body.type,
        partyName: body.partyName,
        amount,
        paidAmount,
        status: computeStatus(amount, paidAmount),
        dueDate,
        startDate: body.startDate === undefined ? undefined : startDate,
        installmentCount,
        installmentPaid,
        note: body.note,
      },
    });

    emitBusiness(req.businessId!, "debt:changed", { action: "update", debt });
    return ok(res, enrichDebt(debt));
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal update", 500);
  }
});

router.delete("/:id", requireRoles("OWNER", "ADMIN"), async (req, res) => {
  const existing = await prisma.debt.findFirst({
    where: { id: String(req.params.id), businessId: req.businessId, deletedAt: null },
  });
  if (!existing) return fail(res, "Data tidak ditemukan", 404);

  await prisma.debt.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });
  await logActivity("DEBT_DELETE", existing.partyName, req.user!.id, req.businessId);
  emitBusiness(req.businessId!, "debt:changed", { action: "delete", id: existing.id });
  return ok(res, { message: "Dihapus (arsip)" });
});

export default router;
