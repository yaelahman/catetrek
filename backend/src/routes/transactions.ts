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

function serializeTx<T extends { amount: unknown; quantity?: unknown }>(tx: T) {
  return {
    ...tx,
    amount: money(tx.amount),
    quantity: tx.quantity == null ? null : money(tx.quantity),
  };
}

function emptyToNull(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "" || v === "null") return null;
  return String(v);
}

const txInclude = {
  account: true,
  category: true,
  product: true,
  transferFrom: true,
  transferTo: true,
  createdBy: { select: { id: true, name: true } },
} as const;

async function resolveProductSale(
  businessId: string,
  type: string,
  productId: string | null | undefined,
  quantityRaw: number | null | undefined
) {
  if (!productId) {
    return { productId: null as string | null, quantity: null as number | null, product: null as null };
  }
  if (type !== "INCOME") {
    throw new Error("Produk hanya bisa dipilih pada transaksi pemasukan");
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, businessId, isActive: true },
  });
  if (!product) throw new Error("Produk tidak ditemukan atau nonaktif");

  const quantity = money(quantityRaw && quantityRaw > 0 ? quantityRaw : 1);
  if (product.stock != null && product.stock < quantity) {
    throw new Error(`Stok tidak cukup. Tersedia: ${product.stock} ${product.unit}`);
  }

  return { productId: product.id, quantity, product };
}

router.get("/", async (req, res) => {
  const {
    page = "1",
    limit = "20",
    type,
    accountId,
    categoryId,
    productId,
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
  if (productId) where.productId = productId;
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
      include: txInclude,
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

/** Penjualan multi-produk: 1 transaksi pemasukan per item. */
router.post("/sale", requireRoles("OWNER", "ADMIN", "STAFF"), async (req, res) => {
  try {
    const schema = z.object({
      accountId: z.string().min(1),
      date: z.string(),
      categoryId: z.string().optional(),
      note: z.string().optional(),
      items: z
        .array(
          z.object({
            productId: z.string().min(1),
            quantity: z.coerce.number().positive(),
          })
        )
        .min(1),
    });
    const body = schema.parse(req.body);

    const account = await prisma.account.findFirst({
      where: { id: body.accountId, businessId: req.businessId, isActive: true },
    });
    if (!account) return fail(res, "Akun tidak ditemukan", 400);

    let categoryId = body.categoryId || null;
    if (!categoryId) {
      const cat =
        (await prisma.category.findFirst({
          where: {
            businessId: req.businessId,
            type: "INCOME",
            isActive: true,
            name: { contains: "Penjualan Produk" },
          },
        })) ||
        (await prisma.category.findFirst({
          where: {
            businessId: req.businessId,
            type: "INCOME",
            isActive: true,
            name: { contains: "Penjualan" },
          },
        })) ||
        (await prisma.category.findFirst({
          where: { businessId: req.businessId, type: "INCOME", isActive: true },
        }));
      if (!cat) return fail(res, 'Belum ada kategori pemasukan. Buat kategori "Penjualan Produk" dulu.', 400);
      categoryId = cat.id;
    } else {
      const cat = await prisma.category.findFirst({
        where: { id: categoryId, businessId: req.businessId, type: "INCOME", isActive: true },
      });
      if (!cat) return fail(res, "Kategori pemasukan tidak valid", 400);
    }

    // Gabungkan qty produk yang sama
    const qtyMap = new Map<string, number>();
    for (const item of body.items) {
      const q = money(item.quantity);
      qtyMap.set(item.productId, money((qtyMap.get(item.productId) || 0) + q));
    }

    const productIds = [...qtyMap.keys()];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, businessId: req.businessId, isActive: true },
    });
    if (products.length !== productIds.length) {
      return fail(res, "Ada produk yang tidak ditemukan atau nonaktif", 400);
    }

    for (const product of products) {
      const qty = qtyMap.get(product.id)!;
      if (product.stock != null && product.stock < Math.round(qty)) {
        return fail(
          res,
          `Stok "${product.name}" tidak cukup. Tersedia: ${product.stock} ${product.unit}`,
          400
        );
      }
    }

    const date = new Date(body.date);
    const notePrefix = body.note?.trim();

    const created = await prisma.$transaction(async (db) => {
      const txs = [];
      for (const product of products) {
        const quantity = qtyMap.get(product.id)!;
        const amount = money(Number(product.price) * quantity);
        const note =
          notePrefix ||
          `Penjualan: ${product.name}${quantity > 1 ? ` × ${quantity} ${product.unit}` : ""}`;

        const tx = await db.transaction.create({
          data: {
            type: "INCOME",
            amount,
            date,
            note,
            businessId: req.businessId!,
            accountId: body.accountId,
            categoryId,
            productId: product.id,
            quantity,
            createdById: req.user!.id,
          },
          include: txInclude,
        });
        txs.push(tx);

        if (product.stock != null) {
          await db.product.update({
            where: { id: product.id },
            data: { stock: Math.max(0, product.stock - Math.round(quantity)) },
          });
        }
      }
      return txs;
    });

    const total = created.reduce((s, t) => s + money(t.amount), 0);
    await logActivity(
      "PRODUCT_SALE",
      `${created.length} item · ${total}`,
      req.user!.id,
      req.businessId
    );
    emitBusiness(req.businessId!, "transaction:changed", {
      action: "sale",
      count: created.length,
    });
    emitBusiness(req.businessId!, "product:changed", { action: "stock" });

    return ok(
      res,
      {
        items: created.map(serializeTx),
        count: created.length,
        total,
      },
      201
    );
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    console.error(err);
    return fail(res, "Gagal menyimpan penjualan", 500);
  }
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
      productId: z.string().optional().nullable(),
      quantity: z.coerce.number().positive().optional().nullable(),
      transferFromId: z.string().optional(),
      transferToId: z.string().optional(),
    });

    const body = schema.parse({
      ...req.body,
      productId: emptyToNull(req.body.productId),
    });
    const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
    let amount = money(body.amount);

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

    let productId: string | null = null;
    let quantity: number | null = null;

    try {
      const resolved = await resolveProductSale(
        req.businessId!,
        body.type,
        body.productId,
        body.quantity ?? undefined
      );
      productId = resolved.productId;
      quantity = resolved.quantity;
      // Jika produk dipilih & amount tidak diisi khusus, hitung dari harga × qty (amount sudah dari form)
      if (resolved.product && (!body.amount || body.amount <= 0)) {
        amount = money(Number(resolved.product.price) * (quantity || 1));
      }
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : "Produk tidak valid", 400);
    }

    const tx = await prisma.$transaction(async (db) => {
      const created = await db.transaction.create({
        data: {
          type: body.type,
          amount,
          date: new Date(body.date),
          note: body.note,
          attachmentUrl,
          businessId: req.businessId!,
          accountId: body.type === "TRANSFER" ? null : body.accountId,
          categoryId: body.type === "TRANSFER" ? null : body.categoryId,
          productId: body.type === "INCOME" ? productId : null,
          quantity: body.type === "INCOME" ? quantity : null,
          transferFromId: body.type === "TRANSFER" ? body.transferFromId : null,
          transferToId: body.type === "TRANSFER" ? body.transferToId : null,
          createdById: req.user!.id,
        },
        include: txInclude,
      });

      if (productId && quantity != null) {
        const product = await db.product.findUnique({ where: { id: productId } });
        if (product?.stock != null) {
          await db.product.update({
            where: { id: productId },
            data: { stock: Math.max(0, product.stock - Math.round(quantity)) },
          });
        }
      }

      return created;
    });

    await logActivity("TRANSACTION_CREATE", `${tx.type} ${amount}`, req.user!.id, req.businessId);
    emitBusiness(req.businessId!, "transaction:changed", { action: "create", transaction: tx });
    if (productId) emitBusiness(req.businessId!, "product:changed", { action: "stock" });
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
      productId: z.string().nullable().optional(),
      quantity: z.coerce.number().positive().optional().nullable(),
      transferFromId: z.string().nullable().optional(),
      transferToId: z.string().nullable().optional(),
    });
    const body = schema.parse({
      ...req.body,
      productId: emptyToNull(req.body.productId),
      accountId: emptyToNull(req.body.accountId),
      categoryId: emptyToNull(req.body.categoryId),
      transferFromId: emptyToNull(req.body.transferFromId),
      transferToId: emptyToNull(req.body.transferToId),
    });

    const existing = await prisma.transaction.findFirst({
      where: { id: String(req.params.id), businessId: req.businessId, deletedAt: null },
    });
    if (!existing) return fail(res, "Transaksi tidak ditemukan", 404);

    const nextType = body.type || existing.type;
    let nextProductId =
      body.productId !== undefined ? body.productId : existing.productId;
    let nextQuantity =
      body.quantity !== undefined
        ? body.quantity
        : existing.quantity != null
          ? Number(existing.quantity)
          : null;

    if (nextType !== "INCOME") {
      nextProductId = null;
      nextQuantity = null;
    } else if (nextProductId) {
      try {
        const resolved = await resolveProductSale(
          req.businessId!,
          nextType,
          nextProductId,
          nextQuantity ?? 1
        );
        // Saat edit, stok dicek relatif: stok + qty lama (dikembalikan dulu)
        if (resolved.product?.stock != null) {
          const oldQty =
            existing.productId === nextProductId && existing.quantity != null
              ? Number(existing.quantity)
              : 0;
          const available = resolved.product.stock + Math.round(oldQty);
          const need = Math.round(resolved.quantity || 1);
          if (available < need) {
            return fail(res, `Stok tidak cukup. Tersedia: ${available} ${resolved.product.unit}`, 400);
          }
        }
        nextProductId = resolved.productId;
        nextQuantity = resolved.quantity;
      } catch (e) {
        return fail(res, e instanceof Error ? e.message : "Produk tidak valid", 400);
      }
    } else {
      nextQuantity = null;
    }

    const tx = await prisma.$transaction(async (db) => {
      // Kembalikan stok lama
      if (existing.productId && existing.quantity != null) {
        const oldProduct = await db.product.findUnique({ where: { id: existing.productId } });
        if (oldProduct?.stock != null) {
          await db.product.update({
            where: { id: existing.productId },
            data: { stock: oldProduct.stock + Math.round(Number(existing.quantity)) },
          });
        }
      }

      const updated = await db.transaction.update({
        where: { id: existing.id },
        data: {
          type: body.type,
          amount: body.amount !== undefined ? money(body.amount) : undefined,
          note: body.note,
          accountId: body.accountId,
          categoryId: body.categoryId,
          productId: nextProductId,
          quantity: nextQuantity,
          transferFromId: body.transferFromId,
          transferToId: body.transferToId,
          date: body.date ? new Date(body.date) : undefined,
          attachmentUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
        },
        include: txInclude,
      });

      // Kurangi stok baru
      if (nextProductId && nextQuantity != null) {
        const product = await db.product.findUnique({ where: { id: nextProductId } });
        if (product?.stock != null) {
          await db.product.update({
            where: { id: nextProductId },
            data: { stock: Math.max(0, product.stock - Math.round(nextQuantity)) },
          });
        }
      }

      return updated;
    });

    emitBusiness(req.businessId!, "transaction:changed", { action: "update", transaction: tx });
    emitBusiness(req.businessId!, "product:changed", { action: "stock" });
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

  await prisma.$transaction(async (db) => {
    await db.transaction.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    if (existing.productId && existing.quantity != null) {
      const product = await db.product.findUnique({ where: { id: existing.productId } });
      if (product?.stock != null) {
        await db.product.update({
          where: { id: existing.productId },
          data: { stock: product.stock + Math.round(Number(existing.quantity)) },
        });
      }
    }
  });

  await logActivity("TRANSACTION_DELETE", existing.id, req.user!.id, req.businessId);
  emitBusiness(req.businessId!, "transaction:changed", { action: "delete", id: existing.id });
  emitBusiness(req.businessId!, "product:changed", { action: "stock" });
  return ok(res, { message: "Transaksi diarsipkan" });
});

export default router;
