/** Derive Catetrek CSS color tokens from a single brand hex. */

export const DEFAULT_BRAND = "#0b5f56";

export const BRAND_PRESETS = [
  { id: "teal", label: "Teal", color: "#0b5f56" },
  { id: "ocean", label: "Ocean", color: "#0e4c92" },
  { id: "forest", label: "Hijau", color: "#1b5e3b" },
  { id: "violet", label: "Ungu", color: "#5b3d8f" },
  { id: "rose", label: "Rose", color: "#9f2d55" },
  { id: "amber", label: "Amber", color: "#9a5b12" },
  { id: "slate", label: "Slate", color: "#3d4f5f" },
  { id: "crimson", label: "Merah", color: "#9f1d1d" },
] as const;

export type BrandMode = "light" | "dark";

function clamp(n: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n));
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return { r: 11, g: 95, b: 86 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number) {
  const to = (v: number) =>
    Math.round(clamp(v, 0, 255))
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function rgbToHsl(r: number, g: number, b: number) {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6;
  else if (max === G) h = ((B - R) / d + 2) / 6;
  else h = ((R - G) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  const H = ((h % 360) + 360) % 360;
  const S = clamp(s);
  const L = clamp(l);
  if (S === 0) {
    const v = L * 255;
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let T = t;
    if (T < 0) T += 1;
    if (T > 1) T -= 1;
    if (T < 1 / 6) return p + (q - p) * 6 * T;
    if (T < 1 / 2) return q;
    if (T < 2 / 3) return p + (q - p) * (2 / 3 - T) * 6;
    return p;
  };
  const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
  const p = 2 * L - q;
  const hk = H / 360;
  return {
    r: hue2rgb(p, q, hk + 1 / 3) * 255,
    g: hue2rgb(p, q, hk) * 255,
    b: hue2rgb(p, q, hk - 1 / 3) * 255,
  };
}

function hslHex(h: number, s: number, l: number) {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

export function normalizeHex(input: string): string | null {
  const raw = input.trim();
  const m = raw.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  const h = m[1];
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return `#${full.toLowerCase()}`;
}

export type BrandTokens = {
  brand: string;
  brandDeep: string;
  brandMid: string;
  brandSoft: string;
  accent: string;
  accentSoft: string;
  sidebar: string;
  sidebarGlow: string;
  bg: string;
  bgElevated: string;
  ink: string;
  muted: string;
  line: string;
  shadowTint: string;
  overlay: string;
};

export function buildBrandTokens(hex: string, mode: BrandMode): BrandTokens {
  const base = normalizeHex(hex) || DEFAULT_BRAND;
  const { r, g, b } = hexToRgb(base);
  const { h, s } = rgbToHsl(r, g, b);
  const sat = clamp(s, 0.25, 0.72);
  const accentH = (h + 38) % 360;

  if (mode === "dark") {
    return {
      brand: hslHex(h, clamp(sat + 0.12, 0.42, 0.78), 0.64),
      brandDeep: hslHex(h, sat, 0.5),
      brandMid: hslHex(h, clamp(sat + 0.08, 0.38, 0.72), 0.58),
      brandSoft: hslHex(h, 0.32, 0.15),
      accent: hslHex(accentH, 0.72, 0.64),
      accentSoft: hslHex(accentH, 0.35, 0.14),
      sidebar: hslHex(h, clamp(sat, 0.32, 0.58), 0.07),
      sidebarGlow: hslHex(h, sat, 0.38),
      bg: hslHex(h, 0.3, 0.07),
      bgElevated: hslHex(h, 0.26, 0.12),
      ink: hslHex(h, 0.14, 0.93),
      muted: hslHex(h, 0.18, 0.68),
      line: hslHex(h, 0.24, 0.2),
      shadowTint: "rgba(0, 0, 0, 0.65)",
      overlay: "rgba(0, 0, 0, 0.55)",
    };
  }

  return {
    brand: hslHex(h, sat, clamp(rgbToHsl(r, g, b).l, 0.18, 0.32)),
    brandDeep: hslHex(h, sat, 0.14),
    brandMid: hslHex(h, clamp(sat - 0.05, 0.25, 0.65), 0.38),
    brandSoft: hslHex(h, 0.32, 0.91),
    accent: hslHex(accentH, 0.68, 0.52),
    accentSoft: hslHex(accentH, 0.55, 0.93),
    sidebar: hslHex(h, clamp(sat + 0.05, 0.35, 0.65), 0.12),
    sidebarGlow: hslHex(h, sat, 0.36),
    bg: hslHex(h, 0.22, 0.94),
    bgElevated: "#ffffff",
    ink: hslHex(h, clamp(sat * 0.8, 0.2, 0.4), 0.12),
    muted: hslHex(h, 0.12, 0.38),
    line: hslHex(h, 0.18, 0.82),
    shadowTint: `rgba(${Math.round(r * 0.4)}, ${Math.round(g * 0.35)}, ${Math.round(b * 0.3)}, 0.45)`,
    overlay: `rgba(${Math.round(r * 0.35)}, ${Math.round(g * 0.28)}, ${Math.round(b * 0.25)}, 0.45)`,
  };
}

export function applyBrandTokens(tokens: BrandTokens) {
  const root = document.documentElement;
  root.style.setProperty("--brand", tokens.brand);
  root.style.setProperty("--brand-deep", tokens.brandDeep);
  root.style.setProperty("--brand-mid", tokens.brandMid);
  root.style.setProperty("--brand-soft", tokens.brandSoft);
  root.style.setProperty("--accent", tokens.accent);
  root.style.setProperty("--accent-soft", tokens.accentSoft);
  root.style.setProperty("--sidebar", tokens.sidebar);
  root.style.setProperty("--sidebar-glow", tokens.sidebarGlow);
  root.style.setProperty("--bg", tokens.bg);
  root.style.setProperty("--bg-elevated", tokens.bgElevated);
  root.style.setProperty("--ink", tokens.ink);
  root.style.setProperty("--muted", tokens.muted);
  root.style.setProperty("--line", tokens.line);
  root.style.setProperty("--overlay", tokens.overlay);
  root.style.setProperty("--shadow", `0 18px 50px -28px ${tokens.shadowTint}`);
  root.style.setProperty("--shadow-soft", `0 10px 30px -20px ${tokens.shadowTint}`);
  root.style.setProperty(
    "--table-head",
    `linear-gradient(90deg, color-mix(in srgb, ${tokens.brandSoft} 85%, transparent), color-mix(in srgb, ${tokens.accentSoft} 50%, transparent))`
  );
}

/** Compact inline script helper for FOUC prevention (no imports). */
export const BRAND_STORAGE_KEY = "catetrek_brand";
