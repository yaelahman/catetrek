"use client";

import { useCallback, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from "lucide-react";
import { Protected } from "@/components/Protected";
import { Button, Card, EmptyState, PageHeader, TableShell } from "@/components/ui";
import { api } from "@/lib/api";
import { cn, formatIDR } from "@/lib/format";
import { useRealtimeRefresh } from "@/lib/socket";

type ChangePct = {
  incomePct: number | null;
  expensePct: number | null;
  netPct: number | null;
};

type Comparison = {
  range: {
    current: { start: string; end: string };
    previous: { start: string; end: string };
  };
  current: { income: number; expense: number; net: number };
  previous: { income: number; expense: number; net: number };
  change: ChangePct;
  months: Array<{
    key: string;
    year: number;
    month: number;
    label: string;
    income: number;
    expense: number;
    net: number;
    change: ChangePct;
  }>;
};

function PctBadge({
  value,
  invertColors = false,
}: {
  value: number | null;
  /** true untuk pengeluaran: naik = buruk (merah), turun = baik (hijau) */
  invertColors?: boolean;
}) {
  if (value === null) {
    return <span className="text-xs text-[var(--muted)]">—</span>;
  }
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--muted)]">
        <Minus size={12} /> 0%
      </span>
    );
  }
  const up = value > 0;
  const good = invertColors ? !up : up;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold",
        good ? "text-[var(--success)]" : "text-[var(--danger)]"
      )}
    >
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(value).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
    </span>
  );
}

export default function ReportsComparisonPage() {
  const [data, setData] = useState<Comparison | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await api<Comparison>("/api/reports/comparison"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat perbandingan");
    }
  }, []);

  useRealtimeRefresh(load);

  return (
    <Protected>
      <PageHeader
        title="Perbandingan"
        subtitle="Ringkasan 12 bulan terakhir dibanding periode sebelumnya, plus perubahan bulanan (MoM)."
        action={
          <Button variant="secondary" onClick={() => void load()}>
            <RefreshCw size={16} /> Refresh
          </Button>
        }
      />

      {error && (
        <p className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {!data ? (
        <p className="text-sm text-[var(--muted)]">Memuat perbandingan...</p>
      ) : (
        <div className="space-y-5">
          <p className="text-xs text-[var(--muted)]">
            Periode sekarang: {data.range.current.start} s/d {data.range.current.end} ·
            Dibanding: {data.range.previous.start} s/d {data.range.previous.end}
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            {(
              [
                {
                  label: "Pemasukan 12 bln",
                  current: data.current.income,
                  previous: data.previous.income,
                  pct: data.change.incomePct,
                  invert: false,
                  color: "text-[var(--success)]",
                },
                {
                  label: "Pengeluaran 12 bln",
                  current: data.current.expense,
                  previous: data.previous.expense,
                  pct: data.change.expensePct,
                  invert: true,
                  color: "text-[var(--danger)]",
                },
                {
                  label: "Net 12 bln",
                  current: data.current.net,
                  previous: data.previous.net,
                  pct: data.change.netPct,
                  invert: false,
                  color: "",
                },
              ] as const
            ).map((card) => (
              <Card key={card.label}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-[var(--muted)]">{card.label}</p>
                  <PctBadge value={card.pct} invertColors={card.invert} />
                </div>
                <p className={cn("mt-2 text-2xl font-bold", card.color)}>{formatIDR(card.current)}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Sebelumnya: {formatIDR(card.previous)}
                </p>
              </Card>
            ))}
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Tabel bulanan (1 tahun terakhir)</h2>
            {data.months.every((m) => m.income === 0 && m.expense === 0) ? (
              <Card>
                <EmptyState
                  title="Belum ada data"
                  desc="Catat transaksi agar perbandingan bulanan muncul di sini."
                />
              </Card>
            ) : (
              <TableShell minWidth="52rem">
                <table className="w-full text-left text-sm">
                  <thead style={{ background: "var(--table-head)" }} className="text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3.5 font-semibold">Bulan</th>
                      <th className="px-4 py-3.5 font-semibold text-right">Pemasukan</th>
                      <th className="px-4 py-3.5 font-semibold text-right">Δ %</th>
                      <th className="px-4 py-3.5 font-semibold text-right">Pengeluaran</th>
                      <th className="px-4 py-3.5 font-semibold text-right">Δ %</th>
                      <th className="px-4 py-3.5 font-semibold text-right">Net</th>
                      <th className="px-4 py-3.5 font-semibold text-right">Δ %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.months.map((m) => (
                      <tr
                        key={m.key}
                        className="border-t border-[var(--line)]/70 transition hover:bg-[var(--brand-soft)]/30"
                      >
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{m.label}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-[var(--success)]">
                          {formatIDR(m.income)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <PctBadge value={m.change.incomePct} />
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-[var(--danger)]">
                          {formatIDR(m.expense)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <PctBadge value={m.change.expensePct} invertColors />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                          {formatIDR(m.net)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <PctBadge value={m.change.netPct} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[var(--line)] bg-[var(--brand-soft)]/40 font-semibold">
                      <td className="px-4 py-3.5">Total 12 bulan</td>
                      <td className="px-4 py-3.5 text-right text-[var(--success)]">
                        {formatIDR(data.current.income)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <PctBadge value={data.change.incomePct} />
                      </td>
                      <td className="px-4 py-3.5 text-right text-[var(--danger)]">
                        {formatIDR(data.current.expense)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <PctBadge value={data.change.expensePct} invertColors />
                      </td>
                      <td className="px-4 py-3.5 text-right">{formatIDR(data.current.net)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <PctBadge value={data.change.netPct} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </TableShell>
            )}
            <p className="mt-2 text-xs text-[var(--muted)]">
              Δ % = perubahan dibanding bulan sebelumnya (MoM). Untuk baris total, dibanding 12 bulan
              sebelum periode ini. Pengeluaran: naik diberi warna merah.
            </p>
          </div>
        </div>
      )}
    </Protected>
  );
}
