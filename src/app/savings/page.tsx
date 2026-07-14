"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Hash,
  NotebookPen,
  Plus,
  Target,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { Protected } from "@/components/Protected";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  TextArea,
} from "@/components/ui";
import { api } from "@/lib/api";
import { confirm, toast } from "@/lib/alert";
import { formatDate, formatIDR } from "@/lib/format";
import { useRealtimeRefresh } from "@/lib/socket";

type Account = { id: string; name: string; isActive: boolean; balance?: number };
type Contribution = {
  id: string;
  amount: number;
  date: string;
  note?: string | null;
  account?: { name: string } | null;
};
type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string | null;
  color: string;
  category: "PURCHASE" | "TRAVEL" | "EMERGENCY" | "EDUCATION" | "OTHER";
  note?: string | null;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  percent: number;
  remaining: number;
  contributions?: Contribution[];
  _count?: { contributions: number };
};

const categoryLabel: Record<Goal["category"], string> = {
  PURCHASE: "Beli Barang",
  TRAVEL: "Traveling",
  EMERGENCY: "Dana Darurat",
  EDUCATION: "Pendidikan",
  OTHER: "Lainnya",
};

const emptyGoal = {
  name: "",
  targetAmount: "",
  deadline: "",
  category: "OTHER",
  color: "#0F766E",
  note: "",
};

export default function SavingsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filter, setFilter] = useState("ACTIVE");
  const [createOpen, setCreateOpen] = useState(false);
  const [contribOpen, setContribOpen] = useState(false);
  const [selected, setSelected] = useState<Goal | null>(null);
  const [form, setForm] = useState(emptyGoal);
  const [contrib, setContrib] = useState({
    type: "DEPOSIT",
    amount: "",
    accountId: "",
    note: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const params = filter ? `?status=${filter}` : "";
    setGoals(await api<Goal[]>(`/api/savings${params}`));
  }, [filter]);

  const loadAccounts = useCallback(async () => {
    const acc = await api<Account[]>("/api/accounts");
    setAccounts(acc.filter((a) => a.isActive !== false));
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useRealtimeRefresh(load);

  async function createGoal(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/savings", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          targetAmount: Number(form.targetAmount),
          deadline: form.deadline || null,
          category: form.category,
          color: form.color,
          note: form.note || undefined,
        }),
      });
      setCreateOpen(false);
      setForm(emptyGoal);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat target");
    } finally {
      setBusy(false);
    }
  }

  async function contribute(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/savings/${selected.id}/contribute`, {
        method: "POST",
        body: JSON.stringify({
          type: contrib.type,
          amount: Number(contrib.amount),
          accountId: contrib.accountId || undefined,
          note: contrib.note || undefined,
          date: contrib.date,
          linkTransaction: Boolean(contrib.accountId),
        }),
      });
      setContribOpen(false);
      setSelected(null);
      setContrib({
        type: "DEPOSIT",
        amount: "",
        accountId: "",
        note: "",
        date: new Date().toISOString().slice(0, 10),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses");
    } finally {
      setBusy(false);
    }
  }

  async function removeGoal(id: string) {
    if (
      !(await confirm({
        title: "Hapus target tabungan?",
        message: "Target beserta seluruh riwayat setoran akan dihapus permanen.",
        confirmText: "Ya, hapus",
        tone: "danger",
      }))
    )
      return;
    await api(`/api/savings/${id}`, { method: "DELETE" });
    toast({ title: "Terhapus", message: "Target tabungan berhasil dihapus.", tone: "success" });
    await load();
  }

  async function cancelGoal(id: string) {
    await api(`/api/savings/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    await load();
  }

  const activeCount = goals.filter((g) => g.status === "ACTIVE").length;

  return (
    <Protected>
      <PageHeader
        title="Tabungan Target"
        subtitle="Kumpulkan dana untuk beli barang, traveling, atau tujuan apa pun — pantau progress sampai tercapai."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Target baru
          </Button>
        }
      />

      <Card className="mb-5 !bg-white dark:!bg-[var(--bg-elevated)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="max-w-xs flex-1">
            <Select label="Filter status" variant="filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="ACTIVE">Aktif</option>
              <option value="COMPLETED">Tercapai</option>
              <option value="CANCELLED">Dibatalkan</option>
              <option value="">Semua</option>
            </Select>
          </div>
          <p className="text-sm text-[var(--muted)]">{activeCount} target aktif</p>
        </div>
      </Card>

      {goals.length === 0 ? (
        <EmptyState
          title="Belum ada target tabungan"
          desc="Buat target pertama, misalnya Liburan Bali, Laptop baru, atau Dana darurat."
        />
      ) : (
        <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((g) => (
            <Card
              key={g.id}
              className="animate-fade-up relative overflow-hidden !bg-white dark:!bg-[var(--bg-elevated)]"
            >
              <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: g.color }} />
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{categoryLabel[g.category]}</Badge>
                    <Badge
                      tone={
                        g.status === "COMPLETED" ? "success" : g.status === "CANCELLED" ? "neutral" : "warning"
                      }
                    >
                      {g.status === "COMPLETED"
                        ? "Tercapai"
                        : g.status === "CANCELLED"
                          ? "Dibatalkan"
                          : "Berjalan"}
                    </Badge>
                  </div>
                  <h2 className="text-lg font-bold">{g.name}</h2>
                  {g.deadline && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]">
                      <CalendarDays size={12} /> Target {formatDate(g.deadline)}
                    </p>
                  )}
                </div>
                {g.status === "COMPLETED" && (
                  <CheckCircle2 className="text-[var(--success)]" size={22} />
                )}
              </div>

              <div className="mb-2 flex items-end justify-between gap-2">
                <div>
                  <p className="text-xs text-[var(--muted)]">Terkumpul</p>
                  <p className="text-xl font-bold">{formatIDR(g.currentAmount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--muted)]">Target</p>
                  <p className="font-semibold">{formatIDR(g.targetAmount)}</p>
                </div>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-[var(--brand-soft)]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, g.percent)}%`,
                    background: `linear-gradient(90deg, ${g.color}, color-mix(in srgb, ${g.color} 60%, #F0B45A))`,
                  }}
                />
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {Math.round(g.percent)}% · sisa {formatIDR(g.remaining)}
              </p>

              {g.note && <p className="mt-3 text-xs text-[var(--muted)]">{g.note}</p>}

              {g.contributions && g.contributions.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Setoran terbaru
                  </p>
                  {g.contributions.slice(0, 3).map((c) => (
                    <div key={c.id} className="flex justify-between text-xs">
                      <span className="text-[var(--muted)]">
                        {formatDate(c.date)}
                        {c.account ? ` · ${c.account.name}` : ""}
                      </span>
                      <span
                        className={
                          c.amount >= 0 ? "font-semibold text-[var(--success)]" : "font-semibold text-[var(--danger)]"
                        }
                      >
                        {c.amount >= 0 ? "+" : ""}
                        {formatIDR(c.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {g.status === "ACTIVE" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setSelected(g);
                      setContrib((c) => ({ ...c, type: "DEPOSIT" }));
                      setError("");
                      setContribOpen(true);
                    }}
                  >
                    <ArrowDownToLine size={14} /> Setor
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setSelected(g);
                      setContrib((c) => ({ ...c, type: "WITHDRAW" }));
                      setError("");
                      setContribOpen(true);
                    }}
                  >
                    <ArrowUpFromLine size={14} /> Tarik
                  </Button>
                </div>
              )}

              <div className="mt-2 flex justify-end gap-1">
                {g.status === "ACTIVE" && (
                  <Button variant="ghost" onClick={() => cancelGoal(g.id)}>
                    Batalkan
                  </Button>
                )}
                <Button variant="ghost" onClick={() => removeGoal(g.id)}>
                  Hapus
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Buat target tabungan">
        <form onSubmit={createGoal} className="stagger space-y-3.5">
          <Input
            label="Nama target"
            required
            icon={<Target size={16} />}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            hint="Contoh: Liburan Jepang, iPhone 17, Modal stok"
          />
          <Select
            label="Jenis tujuan"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            <option value="PURCHASE">Beli Barang</option>
            <option value="TRAVEL">Traveling</option>
            <option value="EMERGENCY">Dana Darurat</option>
            <option value="EDUCATION">Pendidikan</option>
            <option value="OTHER">Lainnya</option>
          </Select>
          <Input
            label="Target jumlah (Rp)"
            type="number"
            required
            min={1}
            icon={<Hash size={16} />}
            value={form.targetAmount}
            onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
          />
          <Input
            label="Deadline (opsional)"
            type="date"
            icon={<CalendarDays size={16} />}
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
          <Input
            label="Warna progress"
            type="color"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
          />
          <TextArea
            label="Catatan"
            rows={2}
            icon={<NotebookPen size={16} />}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full py-3">
            {busy ? "Menyimpan..." : "Simpan target"}
          </Button>
        </form>
      </Modal>

      <Modal
        open={contribOpen}
        onClose={() => {
          setContribOpen(false);
          setSelected(null);
        }}
        title={contrib.type === "DEPOSIT" ? `Setor: ${selected?.name || ""}` : `Tarik: ${selected?.name || ""}`}
      >
        <form onSubmit={contribute} className="stagger space-y-3.5">
          <Select
            label="Tipe"
            value={contrib.type}
            onChange={(e) => setContrib({ ...contrib, type: e.target.value })}
          >
            <option value="DEPOSIT">Setor (tambah tabungan)</option>
            <option value="WITHDRAW">Tarik (kurangi tabungan)</option>
          </Select>
          <Input
            label="Jumlah"
            type="number"
            required
            min={1}
            icon={<Hash size={16} />}
            value={contrib.amount}
            onChange={(e) => setContrib({ ...contrib, amount: e.target.value })}
          />
          <Select
            label="Dari / ke akun (opsional)"
            icon={<Wallet size={16} />}
            value={contrib.accountId}
            onChange={(e) => setContrib({ ...contrib, accountId: e.target.value })}
            hint="Jika dipilih, otomatis membuat transaksi agar saldo akun ikut berubah"
          >
            <option value="">Tanpa transaksi akun</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Input
            label="Tanggal"
            type="date"
            required
            icon={<CalendarDays size={16} />}
            value={contrib.date}
            onChange={(e) => setContrib({ ...contrib, date: e.target.value })}
          />
          <TextArea
            label="Catatan"
            rows={2}
            icon={<NotebookPen size={16} />}
            value={contrib.note}
            onChange={(e) => setContrib({ ...contrib, note: e.target.value })}
          />
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full py-3">
            {busy ? "Memproses..." : contrib.type === "DEPOSIT" ? "Setor sekarang" : "Tarik sekarang"}
          </Button>
        </form>
      </Modal>
    </Protected>
  );
}
