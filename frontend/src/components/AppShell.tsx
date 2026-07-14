"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Tags,
  PieChart,
  PiggyBank,
  FileBarChart2,
  Handshake,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  Shield,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useSocket } from "@/lib/socket";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/format";
import { PwaInstallHint } from "@/components/PwaInstallHint";

const baseNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transaksi", icon: ArrowLeftRight },
  { href: "/accounts", label: "Akun Dompet", icon: Wallet },
  { href: "/savings", label: "Tabungan Target", icon: PiggyBank },
  { href: "/categories", label: "Kategori", icon: Tags },
  { href: "/budgets", label: "Anggaran", icon: PieChart },
  { href: "/debts", label: "Hutang & Piutang", icon: Handshake },
  { href: "/reports", label: "Laporan", icon: FileBarChart2 },
  { href: "/team", label: "Tim", icon: Users },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, business, logout, setBusinessId } = useAuth();
  const { connected, realtimeEnabled } = useSocket();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const nav = useMemo(() => {
    if (user?.isSuperAdmin) {
      return [...baseNav, { href: "/admin", label: "Super Admin", icon: Shield }];
    }
    return baseNav;
  }, [user?.isSuperAdmin]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_1fr]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[272px] bg-[var(--sidebar)] text-white shadow-[20px_0_60px_-40px_var(--overlay)] transition-transform duration-300 ease-out lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="relative flex h-full flex-col overflow-hidden px-4 py-5">
          <div className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-[var(--sidebar-glow)]/30 blur-3xl" />
          <div className="pointer-events-none absolute -left-8 bottom-24 h-36 w-36 rounded-full bg-[var(--accent)]/20 blur-3xl" />

          <div className="relative mb-8 flex items-center justify-between px-2">
            <div className="animate-slide-right">
              <p className="h-brand text-2xl font-bold tracking-tight">Catetrek</p>
              <p className="mt-1 text-xs text-white/60">Keuangan usaha, realtime</p>
            </div>
            <button className="rounded-lg p-1.5 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Tutup menu">
              <X size={18} />
            </button>
          </div>

          <nav className="relative flex-1 space-y-1">
            {nav.map((item, idx) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  style={{ animationDelay: `${idx * 0.03}s` }}
                  className={cn(
                    "animate-fade-up group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition duration-200",
                    active
                      ? "bg-white/15 text-white shadow-inner"
                      : "text-white/70 hover:bg-white/10 hover:text-white hover:translate-x-0.5"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[var(--accent)]" />
                  )}
                  <span
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-lg transition",
                      active ? "bg-white/15" : "bg-white/5 group-hover:bg-white/10"
                    )}
                  >
                    <Icon size={16} />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="relative mt-4 space-y-3 border-t border-white/10 pt-4">
            <PwaInstallHint variant="sidebar" />
            {user && user.businesses.length > 1 && (
              <select
                className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm outline-none transition focus:border-white/40"
                value={business?.id || ""}
                onChange={(e) => {
                  setBusinessId(e.target.value);
                  router.refresh();
                }}
              >
                {user.businesses.map((b) => (
                  <option key={b.id} value={b.id} className="text-black">
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <div className="rounded-xl bg-white/5 px-3 py-2.5">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs text-white/60">{business?.name}</p>
            </div>
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut size={18} />
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <button
          className="fixed inset-0 z-30 animate-fade-in bg-black/45 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Tutup overlay"
        />
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg-elevated)]/80 px-4 py-3 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] p-2 shadow-sm transition hover:bg-[var(--brand-soft)] lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Buka menu"
            >
              <Menu size={18} />
            </button>
            <div className="animate-fade-up">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Bisnis aktif</p>
              <p className="font-semibold">{business?.name || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold shadow-sm transition hover:bg-[var(--brand-soft)]"
              aria-label="Toggle dark mode"
              title={theme === "dark" ? "Mode terang" : "Mode gelap"}
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              <span className="hidden sm:inline">{theme === "dark" ? "Terang" : "Gelap"}</span>
            </button>
            <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs shadow-sm">
              {realtimeEnabled ? (
                <>
                  <span
                    className={cn(
                      "live-dot inline-block h-2.5 w-2.5 rounded-full",
                      connected ? "bg-emerald-500" : "bg-amber-500"
                    )}
                  />
                  <span className="font-medium">{connected ? "Realtime aktif" : "Menyambung..."}</span>
                </>
              ) : (
                <span className="font-medium text-[var(--muted)]">Realtime off</span>
              )}
            </div>
          </div>
        </header>
        <main className="animate-fade-in px-4 py-6 md:px-8">
          <PwaInstallHint variant="auto" />
          {children}
        </main>
      </div>
    </div>
  );
}
