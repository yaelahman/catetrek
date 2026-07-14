"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Error</p>
      <h2
        className="text-2xl font-bold text-[var(--ink)]"
        style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
      >
        Terjadi kesalahan
      </h2>
      <p className="max-w-md text-sm text-[var(--muted)]">
        {error.message || "Halaman gagal dimuat. Coba muat ulang."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
      >
        Coba lagi
      </button>
    </div>
  );
}
