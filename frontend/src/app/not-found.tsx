import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">404</p>
      <h1
        className="text-3xl font-bold text-[var(--ink)]"
        style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
      >
        Halaman tidak ditemukan
      </h1>
      <p className="max-w-md text-sm text-[var(--muted)]">
        URL yang dibuka tidak ada. Kembali ke dashboard untuk melanjutkan.
      </p>
      <Link
        href="/dashboard"
        className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
      >
        Ke Dashboard
      </Link>
    </div>
  );
}
