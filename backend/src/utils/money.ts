/** Normalize money to 2 decimal places (IDR-safe). */
export function money(value: unknown): number {
  if (value == null || value === "") return 0;
  const n =
    typeof value === "object" && value !== null && "toNumber" in value
      ? Number((value as { toNumber: () => number }).toNumber())
      : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Convert Prisma Decimal / mixed values in objects for JSON responses. */
export function serializeMoneyFields<T extends Record<string, unknown>>(
  row: T,
  fields: string[]
): T {
  const out = { ...row } as Record<string, unknown>;
  for (const f of fields) {
    if (f in out) out[f] = money(out[f]);
  }
  return out as T;
}
