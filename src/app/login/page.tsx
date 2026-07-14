"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Lock, Mail, Moon, Sparkles, Sun } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button, Input } from "@/components/ui";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <button
        type="button"
        onClick={toggleTheme}
        className="fixed right-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg-elevated)]/90 px-3 py-2 text-xs font-semibold shadow-sm backdrop-blur transition hover:bg-[var(--brand-soft)]"
        aria-label="Toggle dark mode"
      >
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        {theme === "dark" ? "Terang" : "Gelap"}
      </button>
      <section className="relative hidden overflow-hidden bg-[var(--sidebar)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="auth-mesh">
          <span />
          <span />
          <span />
        </div>
        <div className="relative animate-slide-right">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur">
            <Sparkles size={14} className="text-[var(--accent)]" />
            Keuangan usaha, realtime
          </div>
          <p className="h-brand text-5xl font-bold leading-none">Catetrek</p>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-teal-50/80">
            Satu tempat untuk kas, anggaran, hutang, dan laporan — update tanpa reload di setiap perangkat.
          </p>
        </div>
        <div className="relative space-y-3 animate-fade-up" style={{ animationDelay: "0.2s" }}>
          {[
            "Dashboard yang langsung bergerak saat data berubah",
            "Form transaksi cepat & nyaman dipakai",
            "Aman untuk tim usaha kecil",
          ].map((t) => (
            <div key={t} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-teal-50/85 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              {t}
            </div>
          ))}
        </div>
      </section>

      <section className="relative flex items-center justify-center px-6 py-12">
        <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
          <div className="auth-mesh opacity-30">
            <span />
            <span />
            <span />
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="relative w-full max-w-md animate-scale-in rounded-[1.75rem] border border-white/70 bg-white/85 p-7 shadow-[var(--shadow)] backdrop-blur-xl sm:p-9"
        >
          <p className="h-brand mb-1 text-3xl font-bold lg:hidden">Catetrek</p>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Selamat datang</p>
          <h1 className="mt-2 text-3xl font-bold">Masuk ke akun</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Kelola kas, transaksi, dan laporan bisnis Anda.</p>

          <div className="stagger mt-8 space-y-4">
            <Input
              label="Email bisnis"
              type="email"
              required
              icon={<Mail size={16} />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              required
              icon={<Lock size={16} />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {error && (
              <p className="animate-fade-up rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full py-3 text-base">
              {busy ? "Memproses..." : "Masuk ke dashboard"}
              {!busy && <ArrowRight size={16} />}
            </Button>
          </div>

          <div className="mt-7 flex justify-between text-sm">
            <Link href="/forgot-password" className="font-medium text-[var(--brand)] transition hover:opacity-70">
              Lupa password?
            </Link>
            <Link href="/register" className="font-semibold text-[var(--brand)] transition hover:opacity-70">
              Daftar bisnis
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
