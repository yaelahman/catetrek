"use client";

import { useCallback, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Protected } from "@/components/Protected";
import { Button, Card, PageHeader, Select, Input } from "@/components/ui";
import { API_URL, api } from "@/lib/api";
import { formatIDR } from "@/lib/format";
import { MONTH_NAMES } from "@/lib/months";
import { useRealtimeRefresh } from "@/lib/socket";

type Report = {
  period: string;
  start: string;
  end: string;
  income: number;
  expense: number;
  net: number;
  byCategory: Array<{ category?: { name: string; color: string; type: string }; amount: number }>;
  byAccount: Array<{ account?: { name: string }; amount: number }>;
};

async function downloadExport(path: string, filename: string) {
  const token = localStorage.getItem("catetrek_token");
  const businessId = localStorage.getItem("catetrek_business_id");
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Business-Id": businessId || "",
    },
  });
  if (!res.ok) throw new Error("Gagal mengunduh file");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const now = new Date();
  const [period, setPeriod] = useState("month");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<Report | null>(null);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ period, month: String(month), year: String(year) });
    setData(await api<Report>(`/api/reports/summary?${params}`));
  }, [period, month, year]);

  useRealtimeRefresh(load);

  async function exportCsv() {
    setExporting("csv");
    try {
      await downloadExport("/api/reports/export.csv", "catetrek-transaksi.csv");
    } finally {
      setExporting(null);
    }
  }

  async function exportPdf() {
    setExporting("pdf");
    try {
      const params = new URLSearchParams({
        period,
        month: String(month),
        year: String(year),
      });
      await downloadExport(
        `/api/reports/export.pdf?${params}`,
        `catetrek-laporan-${year}-${String(month).padStart(2, "0")}.pdf`
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <Protected>
      <PageHeader
        title="Laporan"
        subtitle="Ringkasan kinerja keuangan dan export arsip transaksi."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportCsv} disabled={!!exporting}>
              <Download size={16} />
              {exporting === "csv" ? "Mengunduh..." : "Export CSV"}
            </Button>
            <Button onClick={exportPdf} disabled={!!exporting}>
              <FileText size={16} />
              {exporting === "pdf" ? "Mengunduh..." : "Export PDF"}
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Select label="Periode" variant="filter" value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="month">Bulanan</option>
          <option value="year">Tahunan</option>
        </Select>
        {period === "month" && (
          <Select label="Bulan" variant="filter" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </Select>
        )}
        <Input
          label="Tahun"
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
      </div>

      {!data ? (
        <p className="text-[var(--muted)]">Memuat laporan...</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <p className="text-sm text-[var(--muted)]">Pemasukan</p>
              <p className="mt-2 text-2xl font-bold text-[var(--success)]">{formatIDR(data.income)}</p>
            </Card>
            <Card>
              <p className="text-sm text-[var(--muted)]">Pengeluaran</p>
              <p className="mt-2 text-2xl font-bold text-[var(--danger)]">{formatIDR(data.expense)}</p>
            </Card>
            <Card>
              <p className="text-sm text-[var(--muted)]">Net</p>
              <p className="mt-2 text-2xl font-bold">{formatIDR(data.net)}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {data.start} s/d {data.end}
              </p>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-4 text-lg font-semibold">Per kategori</h2>
              <div className="space-y-3">
                {data.byCategory.length === 0 && (
                  <p className="text-sm text-[var(--muted)]">Belum ada data.</p>
                )}
                {data.byCategory.map((row, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: row.category?.color || "#64748B" }}
                      />
                      {row.category?.name || "Tanpa kategori"}
                    </span>
                    <span className="font-semibold">{formatIDR(row.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <h2 className="mb-4 text-lg font-semibold">Per akun</h2>
              <div className="space-y-3">
                {data.byAccount.length === 0 && (
                  <p className="text-sm text-[var(--muted)]">Belum ada data.</p>
                )}
                {data.byAccount.map((row, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{row.account?.name || "—"}</span>
                    <span className="font-semibold">{formatIDR(row.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </Protected>
  );
}
