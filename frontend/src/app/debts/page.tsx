"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Protected } from "@/components/Protected";
import { Badge, Button, EmptyState, Input, Modal, PageHeader, Select, TextArea } from "@/components/ui";
import { api } from "@/lib/api";
import { confirm, toast } from "@/lib/alert";
import { formatDate, formatIDR } from "@/lib/format";
import { useRealtimeRefresh, useSocket } from "@/lib/socket";
import { CalendarDays, Filter, Hash, NotebookPen, Repeat, UserRound, Wallet } from "lucide-react";

type Account = { id: string; name: string; isActive: boolean };

type Debt = {
  id: string;
  type: "PAYABLE" | "RECEIVABLE";
  partyName: string;
  amount: number;
  paidAmount: number;
  status: "UNPAID" | "PARTIAL" | "PAID";
  dueDate?: string | null;
  startDate?: string | null;
  note?: string | null;
  installmentCount: number;
  installmentPaid: number;
  remainingInstallments: number;
  isInstallment: boolean;
  installmentAmount: number;
  nextInstallmentAmount: number;
  nextDueDate?: string | null;
  endDate?: string | null;
};

const emptyForm = {
  type: "PAYABLE",
  partyName: "",
  amount: "",
  paidAmount: "0",
  dueDate: "",
  installmentCount: "1",
  installmentPaid: "0",
  note: "",
};

type PayMode = "installment" | "full";

export default function DebtsPage() {
  const { bump } = useSocket();
  const [items, setItems] = useState<Debt[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({
    partyName: "",
    amount: "",
    note: "",
    dueDate: "",
    installmentCount: "1",
  });
  const [payOpen, setPayOpen] = useState(false);
  const [payDebt, setPayDebt] = useState<Debt | null>(null);
  const [payMode, setPayMode] = useState<PayMode>("installment");
  const [payAccountId, setPayAccountId] = useState("");
  const [error, setError] = useState("");
  const [editError, setEditError] = useState("");
  const [payError, setPayError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const periods = Math.max(1, Number(form.installmentCount) || 1);
  const previewPerPeriod = useMemo(() => {
    const total = Number(form.amount) || 0;
    if (!total || periods <= 1) return 0;
    return Math.floor((total / periods) * 100) / 100;
  }, [form.amount, periods]);

  const load = useCallback(async () => {
    const params = filter ? `?type=${filter}` : "";
    setItems(await api<Debt[]>(`/api/debts${params}`));
  }, [filter]);

  const loadAccounts = useCallback(async () => {
    const acc = await api<Account[]>("/api/accounts");
    setAccounts(acc.filter((a) => a.isActive !== false));
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useRealtimeRefresh(load);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const count = Math.max(1, Number(form.installmentCount) || 1);
      await api("/api/debts", {
        method: "POST",
        body: JSON.stringify({
          type: form.type,
          partyName: form.partyName,
          amount: Number(form.amount),
          paidAmount: Number(form.paidAmount || 0),
          dueDate: form.dueDate || null,
          startDate: form.dueDate || null,
          installmentCount: count,
          installmentPaid: Math.min(count, Math.max(0, Number(form.installmentPaid) || 0)),
          note: form.note,
        }),
      });
      setOpen(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    }
  }

  function openPay(d: Debt, mode: PayMode) {
    setPayDebt(d);
    setPayMode(mode);
    setPayAccountId(accounts[0]?.id || "");
    setPayError("");
    setPayOpen(true);
  }

  async function confirmPay(e: FormEvent) {
    e.preventDefault();
    if (!payDebt) return;
    if (!payAccountId) {
      setPayError("Pilih akun agar pembayaran tercatat di transaksi.");
      return;
    }
    setBusyId(payDebt.id);
    setPayError("");
    try {
      const remaining = payDebt.amount - payDebt.paidAmount;
      await api(`/api/debts/${payDebt.id}/pay-installment`, {
        method: "POST",
        body: JSON.stringify({
          accountId: payAccountId,
          linkTransaction: true,
          ...(payMode === "full" ? { amount: remaining } : {}),
        }),
      });
      setPayOpen(false);
      setPayDebt(null);
      bump();
      toast({
        title: "Pembayaran tercatat",
        message: "Transaksi baru sudah masuk di menu Transaksi (paling atas).",
        tone: "success",
      });
      await load();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Gagal bayar");
    } finally {
      setBusyId(null);
    }
  }

  function openEdit(d: Debt) {
    setEditingId(d.id);
    setEditForm({
      partyName: d.partyName,
      amount: String(d.amount),
      note: d.note || "",
      dueDate: (d.startDate || d.dueDate || "").slice(0, 10),
      installmentCount: String(d.installmentCount),
    });
    setEditError("");
    setEditOpen(true);
  }

  async function onEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditError("");
    try {
      const count = Math.max(1, Number(editForm.installmentCount) || 1);
      await api(`/api/debts/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          partyName: editForm.partyName,
          amount: Number(editForm.amount),
          note: editForm.note,
          dueDate: editForm.dueDate || null,
          startDate: editForm.dueDate || null,
          installmentCount: count,
        }),
      });
      setEditOpen(false);
      setEditingId(null);
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Gagal");
    }
  }

  async function remove(id: string) {
    if (
      !(await confirm({
        title: "Arsipkan hutang/piutang?",
        message: "Data akan disembunyikan dari daftar aktif.",
        confirmText: "Ya, arsipkan",
        tone: "danger",
      }))
    )
      return;
    await api(`/api/debts/${id}`, { method: "DELETE" });
    toast({ title: "Diarsipkan", message: "Data berhasil diarsipkan.", tone: "success" });
    await load();
  }

  const tone = (s: Debt["status"]) =>
    s === "PAID" ? "success" : s === "PARTIAL" ? "warning" : "danger";

  const statusLabel = (s: Debt["status"]) =>
    s === "PAID" ? "Lunas" : s === "PARTIAL" ? "Sebagian" : "Belum bayar";

  const payTitle =
    payMode === "installment"
      ? "Bayar 1 cicilan"
      : "Tandai lunas";

  const payAmountLabel =
    payDebt && payMode === "installment"
      ? formatIDR(payDebt.nextInstallmentAmount || payDebt.installmentAmount)
      : payDebt
        ? formatIDR(payDebt.amount - payDebt.paidAmount)
        : "";

  return (
    <Protected>
      <PageHeader
        title="Hutang & Piutang"
        subtitle="Pantau kewajiban, tagihan, dan cicilan multi-periode."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Tambah
          </Button>
        }
      />

      <div className="mb-5 max-w-xs">
        <Select
          label="Filter tipe"
          variant="filter"
          icon={<Filter size={16} />}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Semua</option>
          <option value="PAYABLE">Hutang</option>
          <option value="RECEIVABLE">Piutang</option>
        </Select>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Belum ada data" desc="Catat hutang usaha atau piutang pelanggan di sini." />
      ) : (
        <div className="animate-fade-up overflow-hidden rounded-[1.35rem] border border-[var(--line)] bg-white shadow-[var(--shadow-soft)] dark:bg-[var(--bg-elevated)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--brand-soft)] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3.5 font-semibold">Pihak</th>
                  <th className="px-4 py-3.5 font-semibold">Tipe</th>
                  <th className="px-4 py-3.5 font-semibold">Cicilan</th>
                  <th className="px-4 py-3.5 font-semibold">Status</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Sisa</th>
                  <th className="px-4 py-3.5 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr
                    key={d.id}
                    className="border-t border-[var(--line)] transition hover:bg-[var(--brand-soft)]/40"
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-medium">{d.partyName}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {d.isInstallment
                          ? d.nextDueDate
                            ? `Cicilan berikutnya ${formatDate(d.nextDueDate)}`
                            : "Cicilan selesai"
                          : d.dueDate
                            ? `Jatuh tempo ${formatDate(d.dueDate)}`
                            : "Tanpa jatuh tempo"}
                      </p>
                      {d.isInstallment && d.endDate && (
                        <p className="text-xs text-[var(--muted)]">Selesai {formatDate(d.endDate)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">{d.type === "PAYABLE" ? "Hutang" : "Piutang"}</td>
                    <td className="px-4 py-3.5">
                      {d.isInstallment ? (
                        <div>
                          <p className="font-semibold">
                            {d.installmentPaid}/{d.installmentCount}x
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            ≈ {formatIDR(d.installmentAmount)} / bln
                          </p>
                        </div>
                      ) : (
                        <span className="text-[var(--muted)]">Sekaligus</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge tone={tone(d.status)}>{statusLabel(d.status)}</Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold">
                      {formatIDR(d.amount - d.paidAmount)}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <Button variant="ghost" onClick={() => openEdit(d)}>
                        Edit
                      </Button>
                      {d.status !== "PAID" && d.isInstallment && (
                        <Button
                          variant="ghost"
                          disabled={busyId === d.id}
                          onClick={() => openPay(d, "installment")}
                        >
                          Bayar 1x
                        </Button>
                      )}
                      {d.status !== "PAID" && (
                        <Button
                          variant="ghost"
                          disabled={busyId === d.id}
                          onClick={() => openPay(d, "full")}
                        >
                          Lunas
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => remove(d.id)}>
                        Hapus
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Tambah hutang/piutang">
        <form onSubmit={onSubmit} className="stagger space-y-3.5">
          <Select
            label="Tipe"
            icon={<Filter size={16} />}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="PAYABLE">Hutang</option>
            <option value="RECEIVABLE">Piutang</option>
          </Select>
          <Input
            label="Nama pihak"
            required
            icon={<UserRound size={16} />}
            value={form.partyName}
            onChange={(e) => setForm({ ...form, partyName: e.target.value })}
          />
          <Input
            label="Jumlah total"
            type="number"
            required
            min={1}
            icon={<Hash size={16} />}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <Input
            label="Jumlah periode cicilan"
            type="number"
            required
            min={1}
            max={120}
            icon={<Repeat size={16} />}
            value={form.installmentCount}
            onChange={(e) => setForm({ ...form, installmentCount: e.target.value })}
            hint="Contoh: 13 = cicilan 13 bulan. Isi 1 jika bayar sekaligus."
          />
          {periods > 1 && (
            <>
              <p className="rounded-xl border border-[var(--line)] bg-[var(--brand-soft)] px-3 py-2 text-sm text-[var(--ink)]">
                Perkiraan per periode: <strong>{formatIDR(previewPerPeriod)}</strong>
                {form.dueDate && (
                  <>
                    {" "}
                    · selesai sekitar{" "}
                    <strong>
                      {formatDate(
                        new Date(
                          new Date(form.dueDate).setMonth(new Date(form.dueDate).getMonth() + periods - 1)
                        ).toISOString()
                      )}
                    </strong>
                  </>
                )}
              </p>
              <Input
                label="Sudah dibayar berapa kali"
                type="number"
                min={0}
                max={periods}
                icon={<Hash size={16} />}
                value={form.installmentPaid}
                onChange={(e) => setForm({ ...form, installmentPaid: e.target.value })}
                hint="Opsional — jika sudah jalan di tengah cicilan"
              />
            </>
          )}
          <Input
            label="Sudah dibayar / diterima (Rp)"
            type="number"
            min={0}
            icon={<Hash size={16} />}
            value={form.paidAmount}
            onChange={(e) => setForm({ ...form, paidAmount: e.target.value })}
            hint={
              periods > 1
                ? "Boleh dikosongkan/0 — otomatis dihitung dari jumlah cicilan yang sudah dibayar"
                : undefined
            }
          />
          <Input
            label={periods > 1 ? "Tanggal cicilan pertama" : "Jatuh tempo"}
            type="date"
            icon={<CalendarDays size={16} />}
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            hint={periods > 1 ? "Periode berikutnya otomatis +1 bulan" : undefined}
          />
          <TextArea
            label="Catatan"
            rows={2}
            icon={<NotebookPen size={16} />}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <Button type="submit" className="w-full py-3">
            Simpan
          </Button>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit hutang/piutang">
        <form onSubmit={onEditSubmit} className="stagger space-y-3.5">
          <Input
            label="Nama pihak"
            required
            icon={<UserRound size={16} />}
            value={editForm.partyName}
            onChange={(e) => setEditForm({ ...editForm, partyName: e.target.value })}
          />
          <Input
            label="Jumlah total"
            type="number"
            required
            min={1}
            icon={<Hash size={16} />}
            value={editForm.amount}
            onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
          />
          <Input
            label="Jumlah periode cicilan"
            type="number"
            required
            min={1}
            max={120}
            icon={<Repeat size={16} />}
            value={editForm.installmentCount}
            onChange={(e) => setEditForm({ ...editForm, installmentCount: e.target.value })}
          />
          <Input
            label={
              Number(editForm.installmentCount) > 1 ? "Tanggal cicilan pertama" : "Jatuh tempo"
            }
            type="date"
            icon={<CalendarDays size={16} />}
            value={editForm.dueDate}
            onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
          />
          <TextArea
            label="Catatan"
            rows={2}
            icon={<NotebookPen size={16} />}
            value={editForm.note}
            onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
          />
          {editError && <p className="text-sm text-[var(--danger)]">{editError}</p>}
          <Button type="submit" className="w-full py-3">
            Simpan perubahan
          </Button>
        </form>
      </Modal>

      <Modal
        open={payOpen}
        onClose={() => {
          setPayOpen(false);
          setPayDebt(null);
        }}
        title={payTitle}
      >
        <form onSubmit={confirmPay} className="stagger space-y-3.5">
          {payDebt && (
            <p className="rounded-xl border border-[var(--line)] bg-[var(--brand-soft)] px-3 py-2 text-sm">
              <strong>{payDebt.partyName}</strong> — {payAmountLabel}
            </p>
          )}
          <Select
            label="Dari / ke akun"
            required
            icon={<Wallet size={16} />}
            value={payAccountId}
            onChange={(e) => setPayAccountId(e.target.value)}
            hint={
              payDebt?.type === "PAYABLE"
                ? "Wajib — membuat transaksi pengeluaran di buku kas"
                : "Wajib — membuat transaksi pemasukan di buku kas"
            }
          >
            <option value="">Pilih akun</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          {payError && <p className="text-sm text-[var(--danger)]">{payError}</p>}
          <Button type="submit" disabled={busyId !== null} className="w-full py-3">
            {busyId ? "Memproses..." : "Konfirmasi & catat transaksi"}
          </Button>
        </form>
      </Modal>
    </Protected>
  );
}
