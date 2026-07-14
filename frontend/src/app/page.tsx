"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Moon, Sun } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/format";

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reveal = () => setShown(true);

    // Sudah di viewport saat mount → tampilkan segera
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
      reveal();
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          io.disconnect();
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -5% 0px" }
    );
    io.observe(el);

    // Fallback: jangan biarkan teks tertahan opacity 0
    const fallback = window.setTimeout(reveal, 1200);

    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return { ref, shown };
}

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 0.65s cubic-bezier(0.22,1,0.36,1) ${delay}s, transform 0.65s cubic-bezier(0.22,1,0.36,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
        Memuat Catetrek...
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--bg)] text-[var(--ink)]">
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-30 transition-all duration-500",
          scrolled
            ? "border-b border-[var(--line)] bg-[var(--bg-elevated)]/90 backdrop-blur-xl"
            : "bg-transparent"
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <p
            className={cn(
              "h-brand text-xl font-bold tracking-tight transition-colors md:text-2xl",
              scrolled ? "text-[var(--ink)]" : "text-white"
            )}
          >
            Catetrek
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className={cn(
                "inline-flex items-center justify-center rounded-xl p-2.5 transition",
                scrolled
                  ? "border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--brand-soft)]"
                  : "border border-white/20 bg-black/15 text-white hover:bg-black/25"
              )}
              aria-label="Ubah mode tampilan"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link
              href="/login"
              className={cn(
                "rounded-xl px-3.5 py-2 text-sm font-semibold transition",
                scrolled
                  ? "text-[var(--ink)] hover:bg-[var(--brand-soft)]"
                  : "border border-white/20 bg-black/15 text-white hover:bg-black/25"
              )}
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className={cn(
                "hidden rounded-xl px-3.5 py-2 text-sm font-semibold transition sm:inline-flex",
                scrolled
                  ? "bg-[var(--brand)] text-white hover:brightness-110"
                  : "bg-white text-[var(--brand-deep)] hover:brightness-95"
              )}
            >
              Daftar
            </Link>
          </div>
        </div>
      </header>

      <section className="relative isolate flex min-h-[100svh] items-end overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing-hero.jpg"
            alt=""
            className="landing-kenburns absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(4,18,16,0.55) 0%, rgba(4,18,16,0.35) 38%, rgba(4,18,16,0.82) 72%, rgba(4,18,16,0.96) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(90% 55% at 50% 100%, color-mix(in srgb, var(--brand) 22%, transparent), transparent 70%)",
          }}
        />

        <div className="relative z-10 w-full px-5 pb-16 pt-32 md:px-8 md:pb-24">
          <div className="mx-auto max-w-6xl">
            <p
              className="landing-brand-in h-brand font-bold leading-[0.88] text-white"
              style={{
                fontSize: "clamp(3.6rem, 12vw, 7.25rem)",
                textShadow: "0 12px 48px rgba(0,0,0,0.55)",
              }}
            >
              Catetrek
            </p>
            <h1
              className="landing-rise mt-6 max-w-2xl font-semibold leading-[1.15] text-white"
              style={{
                fontSize: "clamp(1.35rem, 3.2vw, 2.05rem)",
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                animationDelay: "0.18s",
                textShadow: "0 2px 18px rgba(0,0,0,0.35)",
              }}
            >
              Buku kas usaha yang rapi — dari kasir sampai laporan bulanan.
            </h1>
            <p
              className="landing-rise mt-4 max-w-xl text-base leading-relaxed text-white/85 md:text-lg"
              style={{ animationDelay: "0.3s", textShadow: "0 1px 12px rgba(0,0,0,0.3)" }}
            >
              Catat transaksi, pantau saldo, kelola hutang & anggaran tanpa spreadsheet berantakan.
            </p>
            <div className="landing-rise mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: "0.42s" }}>
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-[#06352f] transition hover:brightness-95"
              >
                Mulai gratis
                <ArrowRight
                  size={16}
                  className="transition-transform duration-300 group-hover:translate-x-0.5"
                />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-black/20 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-black/30"
              >
                Sudah punya akun
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
              Untuk usaha harian
            </p>
            <h2 className="h-brand mt-3 text-3xl font-bold tracking-tight text-[var(--ink)] md:text-5xl md:leading-[1.05]">
              Ganti buku tulis yang mudah hilang.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[var(--ink)]/70 md:text-lg">
              Catetrek menyimpan transaksi, saldo dompet, dan catatan hutang di satu tempat. Dibuka
              dari HP di warung, atau laptop saat tutup toko.
            </p>
            <Link
              href="/register"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)] transition hover:opacity-80"
            >
              Coba sekarang <ArrowRight size={15} />
            </Link>
          </Reveal>

          <Reveal delay={0.12} className="relative">
            <div className="overflow-hidden rounded-[1.75rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/landing-ledger.jpg"
                alt="Mencatat arus kas di buku usaha"
                className="aspect-[16/10] w-full object-cover transition duration-700 hover:scale-[1.02]"
              />
            </div>
            <div
              className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] opacity-70"
              style={{
                background:
                  "radial-gradient(60% 60% at 50% 50%, color-mix(in srgb, var(--brand) 18%, transparent), transparent 70%)",
              }}
            />
          </Reveal>
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--bg-elevated)] px-5 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="h-brand max-w-2xl text-3xl font-bold tracking-tight text-[var(--ink)] md:text-4xl">
              Ringkas dipakai, lengkap saat dibutuhkan.
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-x-12 gap-y-12 md:grid-cols-3">
            {[
              {
                n: "01",
                title: "Kas & transfer",
                body: "Pemasukan, pengeluaran, dan pindah saldo antar dompet — tercatat rapi.",
              },
              {
                n: "02",
                title: "Anggaran & hutang",
                body: "Batas bulanan, cicilan, dan piutang terlihat sebelum jadi masalah.",
              },
              {
                n: "03",
                title: "Laporan & tim",
                body: "Ringkasan bulanan siap dicek; undang staf tanpa berbagi password.",
              },
            ].map((item, i) => (
              <Reveal key={item.n} delay={0.08 + i * 0.1}>
                <p className="h-brand text-5xl font-bold leading-none text-[var(--brand)]/35" aria-hidden>
                  {item.n}
                </p>
                <h3 className="mt-4 text-xl font-semibold tracking-tight text-[var(--ink)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]/70 md:text-[0.95rem]">
                  {item.body}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal className="order-2 lg:order-1">
            <div className="overflow-hidden rounded-[1.75rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/landing-phone.jpg"
                alt="Catetrek siap dibuka di ponsel"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          </Reveal>
          <Reveal delay={0.1} className="order-1 lg:order-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
              Di mana saja
            </p>
            <h2 className="h-brand mt-3 text-3xl font-bold tracking-tight text-[var(--ink)] md:text-5xl md:leading-[1.05]">
              Pasang di layar utama seperti aplikasi.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[var(--ink)]/70 md:text-lg">
              Buka cepat dari ikon HP tanpa Play Store. Cocok untuk kasir yang berlarian dan pemilik
              yang cek laporan di rumah.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden px-5 py-20 md:px-8 md:py-24">
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(160deg, #06352f 0%, #041411 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full opacity-35 blur-3xl"
          style={{ background: "#e09a3a" }}
        />

        <Reveal className="relative z-10 mx-auto max-w-6xl">
          <p className="h-brand text-[clamp(2.5rem,7vw,4.5rem)] font-bold leading-[0.95] text-white">
            Mulai catat
            <br />
            hari ini.
          </p>
          <p className="mt-5 max-w-lg text-base text-white/85 md:text-lg">
            Buat akun bisnis, catat transaksi pertama, dan bawa Catetrek di saku Anda.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-[#06352f] transition hover:brightness-95"
            >
              Buat akun gratis
              <ArrowRight
                size={16}
                className="transition-transform duration-300 group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-black/20 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-black/30"
            >
              Masuk
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-[var(--line)] px-5 py-10 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="h-brand text-xl font-bold text-[var(--ink)]">Catetrek</p>
            <p className="mt-1 text-sm text-[var(--ink)]/65">Pencatatan keuangan untuk usaha kecil.</p>
          </div>
          <div className="flex gap-5 text-sm font-medium text-[var(--ink)]/70">
            <Link href="/login" className="transition hover:text-[var(--brand)]">
              Masuk
            </Link>
            <Link href="/register" className="transition hover:text-[var(--brand)]">
              Daftar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
