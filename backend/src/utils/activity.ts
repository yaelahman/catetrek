import { prisma } from "./prisma";

export async function logActivity(
  action: string,
  detail?: string,
  userId?: string | null,
  businessId?: string | null
) {
  await prisma.activityLog.create({
    data: {
      action,
      detail: detail || null,
      userId: userId || null,
      businessId: businessId || null,
    },
  });
}
