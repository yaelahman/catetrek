import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { ok, fail } from "../utils/response";
import { requireAuth, requireBusiness, requireRoles } from "../middleware/auth";
import { emitBusiness } from "../socket";

const router = Router();
router.use(requireAuth, requireBusiness);

router.get("/", async (req, res) => {
  const now = new Date();
  const month = parseInt((req.query.month as string) || String(now.getMonth() + 1), 10);
  const year = parseInt((req.query.year as string) || String(now.getFullYear()), 10);

  const budgets = await prisma.budget.findMany({
    where: { businessId: req.businessId, month, year },
    include: { category: true },
  });

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const withSpent = await Promise.all(
    budgets.map(async (b) => {
      const spent = await prisma.transaction.aggregate({
        where: {
          businessId: req.businessId,
          categoryId: b.categoryId,
          type: "EXPENSE",
          deletedAt: null,
          date: { gte: start, lte: end },
        },
        _sum: { amount: true },
      });
      const spentAmount = Number(spent._sum.amount || 0);
      const amount = Number(b.amount);
      return {
        ...b,
        amount,
        spent: spentAmount,
        remaining: amount - spentAmount,
        percent: amount > 0 ? Math.min(100, (spentAmount / amount) * 100) : 0,
      };
    })
  );

  return ok(res, withSpent);
});

router.post("/", requireRoles("OWNER", "ADMIN"), async (req, res) => {
  try {
    const schema = z.object({
      categoryId: z.string(),
      amount: z.number().positive(),
      month: z.number().int().min(1).max(12),
      year: z.number().int().min(2000),
    });
    const body = schema.parse(req.body);

    const budget = await prisma.budget.upsert({
      where: {
        businessId_categoryId_month_year: {
          businessId: req.businessId!,
          categoryId: body.categoryId,
          month: body.month,
          year: body.year,
        },
      },
      create: { ...body, businessId: req.businessId! },
      update: { amount: body.amount },
      include: { category: true },
    });

    emitBusiness(req.businessId!, "budget:changed", { action: "upsert", budget });
    return ok(res, budget, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal menyimpan budget", 500);
  }
});

/** Salin kategori + nominal anggaran dari bulan sebelumnya ke bulan yang dipilih. */
router.post("/copy-previous", requireRoles("OWNER", "ADMIN"), async (req, res) => {
  try {
    const schema = z.object({
      month: z.number().int().min(1).max(12),
      year: z.number().int().min(2000),
      /** Jika true, nominal kategori yang sudah ada diganti dengan bulan lalu. Default: hanya isi yang belum ada. */
      overwrite: z.boolean().optional().default(false),
    });
    const body = schema.parse(req.body);

    const prevMonth = body.month === 1 ? 12 : body.month - 1;
    const prevYear = body.month === 1 ? body.year - 1 : body.year;

    const source = await prisma.budget.findMany({
      where: { businessId: req.businessId, month: prevMonth, year: prevYear },
      include: { category: true },
    });

    if (source.length === 0) {
      return fail(res, "Tidak ada anggaran di bulan sebelumnya untuk disalin", 404);
    }

    const existing = await prisma.budget.findMany({
      where: { businessId: req.businessId, month: body.month, year: body.year },
      select: { categoryId: true },
    });
    const existingIds = new Set(existing.map((b) => b.categoryId));

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const b of source) {
      const has = existingIds.has(b.categoryId);
      if (has && !body.overwrite) {
        skipped += 1;
        continue;
      }

      await prisma.budget.upsert({
        where: {
          businessId_categoryId_month_year: {
            businessId: req.businessId!,
            categoryId: b.categoryId,
            month: body.month,
            year: body.year,
          },
        },
        create: {
          businessId: req.businessId!,
          categoryId: b.categoryId,
          amount: b.amount,
          month: body.month,
          year: body.year,
        },
        update: { amount: b.amount },
      });

      if (has) updated += 1;
      else created += 1;
    }

    emitBusiness(req.businessId!, "budget:changed", {
      action: "copy-previous",
      month: body.month,
      year: body.year,
      created,
      updated,
      skipped,
    });

    return ok(res, {
      from: { month: prevMonth, year: prevYear },
      to: { month: body.month, year: body.year },
      created,
      updated,
      skipped,
      totalSource: source.length,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal menyalin anggaran", 500);
  }
});

router.delete("/:id", requireRoles("OWNER", "ADMIN"), async (req, res) => {
  const existing = await prisma.budget.findFirst({
    where: { id: req.params.id, businessId: req.businessId },
  });
  if (!existing) return fail(res, "Budget tidak ditemukan", 404);

  await prisma.budget.delete({ where: { id: existing.id } });
  emitBusiness(req.businessId!, "budget:changed", { action: "delete", id: existing.id });
  return ok(res, { message: "Budget dihapus" });
});

export default router;
