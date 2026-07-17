import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { ok, fail } from "../utils/response";
import { requireAuth, requireBusiness, requireRoles } from "../middleware/auth";
import { emitBusiness } from "../socket";
import { logActivity } from "../utils/activity";
import { money } from "../utils/money";

const router = Router();
router.use(requireAuth, requireBusiness);

function serializeProduct<T extends { price: unknown; stock?: number | null }>(p: T) {
  return { ...p, price: money(p.price) };
}

router.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const includeInactive = String(req.query.includeInactive || "") === "1";

  const products = await prisma.product.findMany({
    where: {
      businessId: req.businessId,
      ...(includeInactive ? {} : { isActive: true }),
      ...(q
        ? {
            OR: [{ name: { contains: q } }, { sku: { contains: q } }],
          }
        : {}),
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return ok(res, products.map(serializeProduct));
});

router.post("/", requireRoles("OWNER", "ADMIN", "STAFF"), async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      sku: z.string().optional().nullable(),
      price: z.coerce.number().nonnegative(),
      stock: z.coerce.number().int().nonnegative().optional().nullable(),
      unit: z.string().min(1).optional(),
      note: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
    });
    const body = schema.parse(req.body);

    const product = await prisma.product.create({
      data: {
        name: body.name.trim(),
        sku: body.sku?.trim() || null,
        price: money(body.price),
        stock: body.stock === undefined || body.stock === null ? null : body.stock,
        unit: body.unit?.trim() || "pcs",
        note: body.note?.trim() || null,
        isActive: body.isActive ?? true,
        businessId: req.businessId!,
      },
    });

    await logActivity("PRODUCT_CREATE", product.name, req.user!.id, req.businessId);
    emitBusiness(req.businessId!, "product:changed", { action: "create", product });
    return ok(res, serializeProduct(product), 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal membuat produk", 500);
  }
});

router.patch("/:id", requireRoles("OWNER", "ADMIN", "STAFF"), async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      sku: z.string().optional().nullable(),
      price: z.coerce.number().nonnegative().optional(),
      stock: z.coerce.number().int().nonnegative().optional().nullable(),
      unit: z.string().min(1).optional(),
      note: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
    });
    const body = schema.parse(req.body);

    const existing = await prisma.product.findFirst({
      where: { id: String(req.params.id), businessId: req.businessId },
    });
    if (!existing) return fail(res, "Produk tidak ditemukan", 404);

    const product = await prisma.product.update({
      where: { id: existing.id },
      data: {
        name: body.name?.trim(),
        sku: body.sku === undefined ? undefined : body.sku?.trim() || null,
        price: body.price !== undefined ? money(body.price) : undefined,
        stock: body.stock === undefined ? undefined : body.stock,
        unit: body.unit?.trim(),
        note: body.note === undefined ? undefined : body.note?.trim() || null,
        isActive: body.isActive,
      },
    });

    await logActivity("PRODUCT_UPDATE", product.name, req.user!.id, req.businessId);
    emitBusiness(req.businessId!, "product:changed", { action: "update", product });
    return ok(res, serializeProduct(product));
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal update produk", 500);
  }
});

router.delete("/:id", requireRoles("OWNER", "ADMIN"), async (req, res) => {
  const existing = await prisma.product.findFirst({
    where: { id: String(req.params.id), businessId: req.businessId },
  });
  if (!existing) return fail(res, "Produk tidak ditemukan", 404);

  const used = await prisma.transaction.count({
    where: { productId: existing.id, deletedAt: null },
  });

  if (used > 0) {
    const product = await prisma.product.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    emitBusiness(req.businessId!, "product:changed", { action: "deactivate", product });
    return ok(res, { message: "Produk dinonaktifkan (sudah dipakai di transaksi)", product: serializeProduct(product) });
  }

  await prisma.product.delete({ where: { id: existing.id } });
  emitBusiness(req.businessId!, "product:changed", { action: "delete", id: existing.id });
  return ok(res, { message: "Produk dihapus" });
});

export default router;
