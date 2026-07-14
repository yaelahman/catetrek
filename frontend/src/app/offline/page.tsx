import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)] px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Offline</p>
      <h1
        className="text-3xl font-bold text-[var(--ink)]"
        style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
      >
        Tidak ada koneksi
      </h1>
      <p className="max-w-sm text-sm text-[var(--muted)]">
        Catetrek belum bisa memuat halaman ini. Periksa internet, lalu coba lagi.
      </p>
      <Link
        href="/dashboard"
        className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
      >
        Coba buka Dashboard
      </Link>
    </main>
  );
}
