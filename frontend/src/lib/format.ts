export function formatIDR(value: number | string | null | undefined) {
  const n = typeof value === "number" ? value : Number(value || 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

/** Parse masked IDR input ("Rp 1.500.000" / "1.500.000") → number. */
export function parseIDR(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

/** Format number/string as typed IDR mask without currency symbol: "1.500.000". */
export function formatIDRMask(value: string | number | null | undefined): string {
  const raw =
    typeof value === "number"
      ? Number.isFinite(value)
        ? String(Math.max(0, Math.round(value)))
        : ""
      : String(value ?? "").replace(/[^\d]/g, "");
  if (!raw) return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

export function formatDate(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
