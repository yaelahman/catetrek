import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { fail } from "../utils/response";
import { prisma } from "../utils/prisma";
import { Role } from "@prisma/client";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  isSuperAdmin?: boolean;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      businessId?: string;
      membershipRole?: Role;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : req.cookies?.token;

    if (!token) return fail(res, "Unauthorized", 401);

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return fail(res, "Unauthorized", 401);
    if (!user.isActive) return fail(res, "Akun dinonaktifkan", 403);

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
    };
    next();
  } catch {
    return fail(res, "Unauthorized", 401);
  }
}

export async function requireBusiness(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId =
      (req.headers["x-business-id"] as string) ||
      (req.query.businessId as string) ||
      (req.body?.businessId as string) ||
      (req.params?.id as string);

    if (!businessId) return fail(res, "Business ID diperlukan", 400);
    if (!req.user) return fail(res, "Unauthorized", 401);

    const membership = await prisma.membership.findUnique({
      where: {
        userId_businessId: { userId: req.user.id, businessId },
      },
    });

    if (!membership) return fail(res, "Akses bisnis ditolak", 403);

    req.businessId = businessId;
    req.membershipRole = membership.role;
    next();
  } catch {
    return fail(res, "Gagal memverifikasi bisnis", 500);
  }
}

export function requireRoles(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.membershipRole || !roles.includes(req.membershipRole)) {
      return fail(res, "Hak akses tidak cukup", 403);
    }
    next();
  };
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return fail(res, "Unauthorized", 401);
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isSuperAdmin: true, isActive: true },
    });
    if (!user?.isActive) return fail(res, "Akun dinonaktifkan", 403);
    if (!user?.isSuperAdmin) return fail(res, "Hanya superadmin yang boleh akses", 403);
    next();
  } catch {
    return fail(res, "Gagal memverifikasi superadmin", 500);
  }
}
