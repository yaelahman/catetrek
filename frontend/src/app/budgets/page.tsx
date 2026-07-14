"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Copy, Hash, Plus, Tags, Trash2 } from "lucide-react";
import { Protected } from "@/components/Protected";
import { Button, Card, EmptyState, Input, Modal, MoneyInput, PageHeader, Select } from "@/components/ui";
import { api } from "@/lib/api";
import { confirm, toast } from "@/lib/alert";
import { formatIDR, parseIDR } from "@/lib/format";
import { MONTH_NAMES } from "@/lib/months";
import { useRealtimeRefresh } from "@/lib/socket";

type Category = { id: string; name: string; type: string; children?: Category[] };
type Budget = {
  id: string;
  amount: number;
  spent: number;
  remaining: number;
  percent: number;
  category: { name: string; color: string };
};

type CopyResult = {
  from: { month: number; year: number };
  to: { month: number; year: number };
  created: number;
  updated: number;
  skipped: number;
  totalSource: number;
};

export default function BudgetsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [items, setItems] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ categoryId: "", amount: "" });
  const [error, setError] = useState("");
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  const prevLabel = useMemo(() => {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return `${MONTH_NAMES[prevMonth - 1]} ${prevYear}`;
  }, [month, year]);

  const loadCats = useCallback(async () => {
    const cats = await api<Category[]>("/api/categories?type=EXPENSE");
    setCategories(cats.flatMap((c) => [c, ...(c.children || [])]));
  }, []);

  const load = useCallback(async () => {
    setItems(await api<Budget[]>(`/api/budgets?month=${month}&year=${year}`));
  }, [month, year]);

  useEffect(() => {
    loadCats();
  }, [loadCats]);

  useEffect(() => {
    setCopyMsg("");
  }, [month, year]);

  useRealtimeRefresh(load);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/budgets", {
        method: "POST",
        body: JSON.stringify({
          categoryId: form.categoryId,
          amount: parseIDR(form.amount),
          month,
          year,
        }),
      });
      setOpen(false);
      setForm({ categoryId: "", amount: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    }
  }

  async function remove(id: string) {
    if (
      !(await confirm({
        title: "Hapus anggaran?",
        message: "Batas pengeluaran kategori ini akan dihapus untuk bulan yang dipilih.",
        confirmText: "Ya, hapus",
        tone: "danger",
      }))
    )
      return;
    await api(`/api/budgets/${id}`, { method: "DELETE" });
    toast({ title: "Terhapus", message: "Anggaran berhasil dihapus.", tone: "success" });
    await load();
  }

  async function copyFromPrevious() {
    const okConfirm = await confirm({
      title: `Salin dari ${prevLabel}?`,
      message:
        items.length > 0
          ? `Kategori baru akan ditambahkan, dan nominal kategori yang sudah ada di ${MONTH_NAMES[month - 1]} ${year} akan diganti sesuai bulan lalu.`
          : `Salin kategori & nominal anggaran dari ${prevLabel} ke ${MONTH_NAMES[month - 1]} ${year}.`,
      confirmText: "Ya, salin",
      tone: "brand",
    });
    if (!okConfirm) return;

    setCopyBusy(true);
    setCopyMsg("");
    try {
      const result = await api<CopyResult>("/api/budgets/copy-previous", {
        method: "POST",
        body: JSON.stringify({
          month,
          year,
          overwrite: items.length > 0,
        }),
      });
      const parts = [
        result.created > 0 ? `${result.created} ditambahkan` : null,
        result.updated > 0 ? `${result.updated} diperbarui` : null,
        result.skipped > 0 ? `${result.skipped} dilewati` : null,
      ].filter(Boolean);
      const msg = parts.length
        ? `Berhasil menyalin dari ${MONTH_NAMES[result.from.month - 1]} ${result.from.year}: ${parts.join(", ")}.`
        : "Tidak ada perubahan.";
      setCopyMsg(msg);
      toast({ title: "Berhasil", message: msg, tone: "success" });
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyalin anggaran";
      setCopyMsg(msg);
      toast({ title: "Gagal", message: msg, tone: "danger" });
    } finally {
      setCopyBusy(false);
    }
  }

  return (
    <Protected>
      <PageHeader
        title="Anggaran"
        subtitle="Kontrol pengeluaran kategori agar tidak melebihi batas bulanan."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={copyBusy} onClick={copyFromPrevious}>
              <Copy size={16} /> {copyBusy ? "Menyalin..." : "Salin dari bulan lalu"}
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} /> Set anggaran
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Select
          label="Bulan"
          variant="filter"
          icon={<CalendarDays size={16} />}
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </Select>
        <Input
          label="Tahun"
          type="number"
          icon={<Hash size={16} />}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
      </div>

      {copyMsg && (
        <p
          className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
            copyMsg.startsWith("Berhasil")
              ? "border-emerald-200 bg-emerald-50 text-[var(--success)] dark:border-emerald-500/30 dark:bg-emerald-500/10"
              : "border-orange-200 bg-orange-50 text-[var(--danger)] dark:border-orange-500/30 dark:bg-orange-500/10"
          }`}
        >
          {copyMsg}
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="Belum ada anggaran"
          desc={`Tetapkan batas pengeluaran per kategori, atau salin dari ${prevLabel}.`}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((b) => (
            <Card key={b.id}>
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-semibold">{b.category.name}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {formatIDR(b.spent)} / {formatIDR(b.amount)}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => remove(b.id)}>
                  <Trash2 size={14} /> Hapus
                </Button>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${b.percent >= 100 ? "bg-orange-600" : b.percent >= 80 ? "bg-amber-500" : "bg-[var(--brand)]"}`}
                  style={{ width: `${Math.min(100, b.percent)}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Sisa {formatIDR(b.remaining)} · {Math.round(b.percent)}%
              </p>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Set anggaran">
        <form onSubmit={onSubmit} className="stagger space-y-3.5">
          <Select
            label="Kategori pengeluaran"
            required
            icon={<Tags size={16} />}
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            <option value="">Pilih kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <MoneyInput
            label="Jumlah budget"
            required
            icon={<Hash size={16} />}
            value={form.amount}
            onValueChange={(raw) => setForm({ ...form, amount: raw })}
          />
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <Button type="submit" className="w-full py-3">
            Simpan anggaran
          </Button>
        </form>
      </Modal>
    </Protected>
  );
}
