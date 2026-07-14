import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { ok, fail } from "../utils/response";
import { requireAuth, requireBusiness, requireRoles } from "../middleware/auth";
import { emitBusiness } from "../socket";
import { logActivity } from "../utils/activity";

const router = Router();
router.use(requireAuth, requireBusiness);

async function ensureSavingsCategory(businessId: string, type: "INCOME" | "EXPENSE", name: string) {
  const existing = await prisma.category.findFirst({
    where: { businessId, name, type, isActive: true },
  });
  if (existing) return existing;
  return prisma.category.create({
    data: {
      businessId,
      name,
      type,
      color: type === "EXPENSE" ? "#0F766E" : "#059669",
      icon: "piggy",
    },
  });
}

function withProgress<T extends { targetAmount: unknown; currentAmount: unknown; status: string }>(goal: T) {
  const targetAmount = Number(goal.targetAmount);
  const currentAmount = Number(goal.currentAmount);
  const percent = targetAmount > 0 ? Math.min(100, (currentAmount / targetAmount) * 100) : 0;
  const remaining = Math.max(0, targetAmount - currentAmount);
  return { ...goal, targetAmount, currentAmount, percent, remaining };
}

router.get("/", async (req, res) => {
  const status = req.query.status as string | undefined;
  const goals = await prisma.savingsGoal.findMany({
    where: {
      businessId: req.businessId,
      ...(status ? { status: status as "ACTIVE" | "COMPLETED" | "CANCELLED" } : {}),
    },
    include: {
      contributions: {
        orderBy: { date: "desc" },
        take: 5,
        include: { account: true },
      },
      _count: { select: { contributions: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return ok(res, goals.map(withProgress));
});

router.get("/:id", async (req, res) => {
  const goal = await prisma.savingsGoal.findFirst({
    where: { id: String(req.params.id), businessId: req.businessId },
    include: {
      contributions: {
        orderBy: { date: "desc" },
        include: { account: true },
      },
    },
  });
  if (!goal) return fail(res, "Target tabungan tidak ditemukan", 404);
  return ok(res, withProgress(goal));
});

router.post("/", requireRoles("OWNER", "ADMIN", "STAFF"), async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      targetAmount: z.number().positive(),
      currentAmount: z.number().min(0).optional(),
      deadline: z.string().nullable().optional(),
      color: z.string().optional(),
      category: z.enum(["PURCHASE", "TRAVEL", "EMERGENCY", "EDUCATION", "OTHER"]).default("OTHER"),
      note: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const currentAmount = body.currentAmount || 0;

    const goal = await prisma.savingsGoal.create({
      data: {
        name: body.name,
        targetAmount: body.targetAmount,
        currentAmount,
        deadline: body.deadline ? new Date(body.deadline) : null,
        color: body.color,
        category: body.category,
        note: body.note,
        status: currentAmount >= body.targetAmount ? "COMPLETED" : "ACTIVE",
        businessId: req.businessId!,
      },
      include: { contributions: true, _count: { select: { contributions: true } } },
    });

    await logActivity("SAVINGS_CREATE", goal.name, req.user!.id, req.businessId);
    emitBusiness(req.businessId!, "savings:changed", { action: "create", goal: withProgress(goal) });
    return ok(res, withProgress(goal), 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal membuat target tabungan", 500);
  }
});

router.patch("/:id", requireRoles("OWNER", "ADMIN", "STAFF"), async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2).optional(),
      targetAmount: z.number().positive().optional(),
      deadline: z.string().nullable().optional(),
      color: z.string().optional(),
      category: z.enum(["PURCHASE", "TRAVEL", "EMERGENCY", "EDUCATION", "OTHER"]).optional(),
      note: z.string().optional(),
      status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
    });
    const body = schema.parse(req.body);

    const existing = await prisma.savingsGoal.findFirst({
      where: { id: String(req.params.id), businessId: req.businessId },
    });
    if (!existing) return fail(res, "Target tabungan tidak ditemukan", 404);

    const targetAmount = body.targetAmount ?? existing.targetAmount;
    let status = body.status ?? existing.status;
    if (!body.status && existing.currentAmount >= targetAmount) status = "COMPLETED";
    if (!body.status && existing.currentAmount < targetAmount && existing.status === "COMPLETED") {
      status = "ACTIVE";
    }

    const goal = await prisma.savingsGoal.update({
      where: { id: existing.id },
      data: {
        name: body.name,
        targetAmount,
        color: body.color,
        category: body.category,
        note: body.note,
        status,
        deadline: body.deadline === undefined ? undefined : body.deadline ? new Date(body.deadline) : null,
      },
      include: {
        contributions: { orderBy: { date: "desc" }, take: 5, include: { account: true } },
        _count: { select: { contributions: true } },
      },
    });

    emitBusiness(req.businessId!, "savings:changed", { action: "update", goal: withProgress(goal) });
    return ok(res, withProgress(goal));
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal update target", 500);
  }
});

router.post("/:id/contribute", requireRoles("OWNER", "ADMIN", "STAFF"), async (req, res) => {
  try {
    const schema = z.object({
      amount: z.number().positive(),
      type: z.enum(["DEPOSIT", "WITHDRAW"]).default("DEPOSIT"),
      accountId: z.string().optional(),
      date: z.string().optional(),
      note: z.string().optional(),
      linkTransaction: z.boolean().default(true),
    });
    const body = schema.parse(req.body);

    const goal = await prisma.savingsGoal.findFirst({
      where: { id: String(req.params.id), businessId: req.businessId },
    });
    if (!goal) return fail(res, "Target tabungan tidak ditemukan", 404);
    if (goal.status === "CANCELLED") return fail(res, "Target sudah dibatalkan", 400);

    if (body.type === "WITHDRAW" && body.amount > goal.currentAmount) {
      return fail(res, "Jumlah tarik melebihi saldo tabungan target", 400);
    }

    const signedAmount = body.type === "DEPOSIT" ? body.amount : -body.amount;
    const date = body.date ? new Date(body.date) : new Date();
    let transactionId: string | null = null;

    if (body.linkTransaction && body.accountId) {
      if (body.type === "DEPOSIT") {
        const category = await ensureSavingsCategory(req.businessId!, "EXPENSE", "Tabungan Target");
        const tx = await prisma.transaction.create({
          data: {
            type: "EXPENSE",
            amount: body.amount,
            date,
            note: body.note || `Setor tabungan: ${goal.name}`,
            businessId: req.businessId!,
            accountId: body.accountId,
            categoryId: category.id,
            createdById: req.user!.id,
          },
        });
        transactionId = tx.id;
        emitBusiness(req.businessId!, "transaction:changed", { action: "create", transaction: tx });
      } else {
        const category = await ensureSavingsCategory(req.businessId!, "INCOME", "Tarik Tabungan");
        const tx = await prisma.transaction.create({
          data: {
            type: "INCOME",
            amount: body.amount,
            date,
            note: body.note || `Tarik tabungan: ${goal.name}`,
            businessId: req.businessId!,
            accountId: body.accountId,
            categoryId: category.id,
            createdById: req.user!.id,
          },
        });
        transactionId = tx.id;
        emitBusiness(req.businessId!, "transaction:changed", { action: "create", transaction: tx });
      }
    }

    const newCurrent = goal.currentAmount + signedAmount;
    const status = newCurrent >= goal.targetAmount ? "COMPLETED" : "ACTIVE";

    const [contribution, updated] = await prisma.$transaction([
      prisma.savingsContribution.create({
        data: {
          amount: signedAmount,
          date,
          note: body.note,
          goalId: goal.id,
          accountId: body.accountId || null,
          transactionId,
          businessId: req.businessId!,
        },
        include: { account: true },
      }),
      prisma.savingsGoal.update({
        where: { id: goal.id },
        data: { currentAmount: newCurrent, status },
        include: {
          contributions: { orderBy: { date: "desc" }, take: 8, include: { account: true } },
          _count: { select: { contributions: true } },
        },
      }),
    ]);

    await logActivity(
      body.type === "DEPOSIT" ? "SAVINGS_DEPOSIT" : "SAVINGS_WITHDRAW",
      `${goal.name}: ${body.amount}`,
      req.user!.id,
      req.businessId
    );

    const result = withProgress(updated);
    emitBusiness(req.businessId!, "savings:changed", {
      action: "contribute",
      goal: result,
      contribution,
    });
    emitBusiness(req.businessId!, "account:changed", { action: "balance" });

    return ok(res, { goal: result, contribution }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    console.error(err);
    return fail(res, "Gagal memproses setoran/tarikan", 500);
  }
});

router.delete("/:id", requireRoles("OWNER", "ADMIN"), async (req, res) => {
  const existing = await prisma.savingsGoal.findFirst({
    where: { id: String(req.params.id), businessId: req.businessId },
  });
  if (!existing) return fail(res, "Target tabungan tidak ditemukan", 404);

  await prisma.savingsGoal.delete({ where: { id: existing.id } });
  emitBusiness(req.businessId!, "savings:changed", { action: "delete", id: existing.id });
  return ok(res, { message: "Target tabungan dihapus" });
});

export default router;
