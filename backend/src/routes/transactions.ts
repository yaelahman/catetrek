import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../utils/prisma";
import { ok, fail } from "../utils/response";
import { requireAuth, requireBusiness, requireRoles } from "../middleware/auth";
import { emitBusiness } from "../socket";
import { logActivity } from "../utils/activity";
import { money } from "../utils/money";

const router = Router();
router.use(requireAuth, requireBusiness);

const uploadDir = process.env.UPLOAD_DIR || "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|pdf/;
    const okExt = allowed.test(path.extname(file.originalname).toLowerCase());
    const okMime = allowed.test(file.mimetype);
    cb(null, okExt && okMime);
  },
});

function serializeTx<T extends { amount: unknown }>(tx: T) {
  return { ...tx, amount: money(tx.amount) };
}

router.get("/", async (req, res) => {
  const {
    page = "1",
    limit = "20",
    type,
    accountId,
    categoryId,
    q,
    startDate,
    endDate,
  } = req.query;

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const where: Record<string, unknown> = { businessId: req.businessId, deletedAt: null };

  if (type) where.type = type;
  if (accountId) {
    where.OR = [
      { accountId: accountId as string },
      { transferFromId: accountId as string },
      { transferToId: accountId as string },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (q) where.note = { contains: q as string };
  if (startDate || endDate) {
    const end = endDate ? new Date(endDate as string) : undefined;
    if (end) end.setHours(23, 59, 59, 999);
    where.date = {
      ...(startDate ? { gte: new Date(startDate as string) } : {}),
      ...(end ? { lte: end } : {}),
    };
  }

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        account: true,
        category: true,
        transferFrom: true,
        transferTo: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { date: "desc" }],
      skip,
      take: limitNum,
    }),
    prisma.transaction.count({ where }),
  ]);

  return ok(res, {
    items: items.map(serializeTx),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  });
});

router.post("/", requireRoles("OWNER", "ADMIN", "STAFF"), upload.single("attachment"), async (req, res) => {
  try {
    const schema = z.object({
      type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
      amount: z.coerce.number().positive(),
      date: z.string(),
      note: z.string().optional(),
      accountId: z.string().optional(),
      categoryId: z.string().optional(),
      transferFromId: z.string().optional(),
      transferToId: z.string().optional(),
    });

    const body = schema.parse(req.body);
    const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
    const amount = money(body.amount);

    if (body.type === "TRANSFER") {
      if (!body.transferFromId || !body.transferToId) {
        return fail(res, "Transfer membutuhkan akun asal dan tujuan", 400);
      }
      if (body.transferFromId === body.transferToId) {
        return fail(res, "Akun transfer tidak boleh sama", 400);
      }
    } else {
      if (!body.accountId) return fail(res, "Akun wajib diisi", 400);
      if (!body.categoryId) return fail(res, "Kategori wajib diisi", 400);
    }

    const tx = await prisma.transaction.create({
      data: {
        type: body.type,
        amount,
        date: new Date(body.date),
        note: body.note,
        attachmentUrl,
        businessId: req.businessId!,
        accountId: body.type === "TRANSFER" ? null : body.accountId,
        categoryId: body.type === "TRANSFER" ? null : body.categoryId,
        transferFromId: body.type === "TRANSFER" ? body.transferFromId : null,
        transferToId: body.type === "TRANSFER" ? body.transferToId : null,
        createdById: req.user!.id,
      },
      include: {
        account: true,
        category: true,
        transferFrom: true,
        transferTo: true,
        createdBy: { select: { id: true, name: true } },
      },
    });

    await logActivity("TRANSACTION_CREATE", `${tx.type} ${amount}`, req.user!.id, req.businessId);
    emitBusiness(req.businessId!, "transaction:changed", { action: "create", transaction: tx });
    return ok(res, serializeTx(tx), 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    console.error(err);
    return fail(res, "Gagal membuat transaksi", 500);
  }
});

router.patch("/:id", requireRoles("OWNER", "ADMIN", "STAFF"), upload.single("attachment"), async (req, res) => {
  try {
    const schema = z.object({
      type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
      amount: z.coerce.number().positive().optional(),
      date: z.string().optional(),
      note: z.string().optional(),
      accountId: z.string().nullable().optional(),
      categoryId: z.string().nullable().optional(),
      transferFromId: z.string().nullable().optional(),
      transferToId: z.string().nullable().optional(),
    });
    const body = schema.parse(req.body);

    const existing = await prisma.transaction.findFirst({
      where: { id: String(req.params.id), businessId: req.businessId, deletedAt: null },
    });
    if (!existing) return fail(res, "Transaksi tidak ditemukan", 404);

    const tx = await prisma.transaction.update({
      where: { id: existing.id },
      data: {
        type: body.type,
        amount: body.amount !== undefined ? money(body.amount) : undefined,
        note: body.note,
        accountId: body.accountId,
        categoryId: body.categoryId,
        transferFromId: body.transferFromId,
        transferToId: body.transferToId,
        date: body.date ? new Date(body.date) : undefined,
        attachmentUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
      },
      include: {
        account: true,
        category: true,
        transferFrom: true,
        transferTo: true,
        createdBy: { select: { id: true, name: true } },
      },
    });

    emitBusiness(req.businessId!, "transaction:changed", { action: "update", transaction: tx });
    return ok(res, serializeTx(tx));
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal update transaksi", 500);
  }
});

router.delete("/:id", requireRoles("OWNER", "ADMIN"), async (req, res) => {
  const existing = await prisma.transaction.findFirst({
    where: { id: String(req.params.id), businessId: req.businessId, deletedAt: null },
  });
  if (!existing) return fail(res, "Transaksi tidak ditemukan", 404);

  await prisma.transaction.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });
  await logActivity("TRANSACTION_DELETE", existing.id, req.user!.id, req.businessId);
  emitBusiness(req.businessId!, "transaction:changed", { action: "delete", id: existing.id });
  return ok(res, { message: "Transaksi diarsipkan" });
});

export default router;
