import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { ok, fail } from "../utils/response";
import { requireAuth, requireBusiness, requireRoles } from "../middleware/auth";
import { emitBusiness } from "../socket";

const router = Router();
router.use(requireAuth, requireBusiness);

router.get("/", async (req, res) => {
  const type = req.query.type as string | undefined;
  const categories = await prisma.category.findMany({
    where: {
      businessId: req.businessId,
      ...(type ? { type: type as "INCOME" | "EXPENSE" } : {}),
    },
    include: { children: true },
    orderBy: { name: "asc" },
  });
  return ok(res, categories.filter((c) => !c.parentId));
});

router.post("/", requireRoles("OWNER", "ADMIN", "STAFF"), async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      type: z.enum(["INCOME", "EXPENSE"]),
      color: z.string().optional(),
      icon: z.string().optional(),
      parentId: z.string().nullable().optional(),
    });
    const body = schema.parse(req.body);

    const category = await prisma.category.create({
      data: {
        name: body.name,
        type: body.type,
        color: body.color,
        icon: body.icon,
        parentId: body.parentId || null,
        businessId: req.businessId!,
        userId: req.user!.id,
      },
    });

    emitBusiness(req.businessId!, "category:changed", { action: "create", category });
    return ok(res, category, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal membuat kategori", 500);
  }
});

router.patch("/:id", requireRoles("OWNER", "ADMIN"), async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
      isActive: z.boolean().optional(),
      parentId: z.string().nullable().optional(),
    });
    const body = schema.parse(req.body);

    const existing = await prisma.category.findFirst({
      where: { id: String(req.params.id), businessId: req.businessId },
    });
    if (!existing) return fail(res, "Kategori tidak ditemukan", 404);

    const category = await prisma.category.update({
      where: { id: existing.id },
      data: body,
    });

    emitBusiness(req.businessId!, "category:changed", { action: "update", category });
    return ok(res, category);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, "Validasi gagal", 400, err.issues);
    return fail(res, "Gagal update kategori", 500);
  }
});

router.delete("/:id", requireRoles("OWNER", "ADMIN"), async (req, res) => {
  const existing = await prisma.category.findFirst({
    where: { id: String(req.params.id), businessId: req.businessId },
  });
  if (!existing) return fail(res, "Kategori tidak ditemukan", 404);

  const used = await prisma.transaction.count({
    where: { categoryId: existing.id, deletedAt: null },
  });
  if (used > 0) {
    const category = await prisma.category.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    emitBusiness(req.businessId!, "category:changed", { action: "deactivate", category });
    return ok(res, { message: "Kategori dinonaktifkan", category });
  }

  await prisma.category.delete({ where: { id: existing.id } });
  emitBusiness(req.businessId!, "category:changed", { action: "delete", id: existing.id });
  return ok(res, { message: "Kategori dihapus" });
});

export default router;
