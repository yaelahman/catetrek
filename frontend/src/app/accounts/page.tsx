"use client";

import { FormEvent, useCallback, useState } from "react";
import { Hash, Palette, Plus, Tags, Wallet } from "lucide-react";
import { Protected } from "@/components/Protected";
import { Button, Card, EmptyState, Input, Modal, PageHeader, Select } from "@/components/ui";
import { api } from "@/lib/api";
import { formatIDR } from "@/lib/format";
import { useRealtimeRefresh } from "@/lib/socket";

type Account = {
  id: string;
  name: string;
  type: string;
  color: string;
  openingBalance: number;
  balance: number;
  isActive: boolean;
};

const emptyForm = {
  name: "",
  type: "CASH",
  color: "#0F766E",
  openingBalance: "0",
};

export default function AccountsPage() {
  const [items, setItems] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setItems(await api<Account[]>("/api/accounts"));
  }, []);

  useRealtimeRefresh(load);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setOpen(true);
  }

  function openEdit(account: Account) {
    setEditingId(account.id);
    setForm({
      name: account.name,
      type: account.type,
      color: account.color,
      openingBalance: String(account.openingBalance),
    });
    setError("");
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditingId(null);
    setError("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = {
        ...form,
        openingBalance: Number(form.openingBalance || 0),
      };
      if (editingId) {
        await api(`/api/accounts/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/api/accounts", { method: "POST", body: JSON.stringify(body) });
      }
      closeModal();
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(account: Account) {
    await api(`/api/accounts/${account.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !account.isActive }),
    });
    await load();
  }

  return (
    <Protected>
      <PageHeader
        title="Akun Dompet"
        subtitle="Kelola kas, bank, e-wallet, dan kartu kredit usaha."
        action={
          <Button onClick={openCreate}>
            <Plus size={16} /> Tambah akun
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState title="Belum ada akun" desc="Buat akun kas atau bank untuk mulai mencatat." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((a) => (
            <Card key={a.id} className={!a.isActive ? "opacity-60" : ""}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: a.color }} />
                    <p className="font-semibold">{a.name}</p>
                  </div>
                  <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{a.type}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Button variant="ghost" onClick={() => openEdit(a)}>
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => toggle(a)}>
                    {a.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              </div>
              <p className="mt-6 text-2xl font-bold">{formatIDR(a.balance)}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Saldo awal {formatIDR(a.openingBalance)}
              </p>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={closeModal} title={editingId ? "Edit akun" : "Tambah akun"}>
        <form onSubmit={onSubmit} className="stagger space-y-3.5">
          <Input
            label="Nama akun"
            required
            icon={<Wallet size={16} />}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Select
            label="Tipe akun"
            icon={<Tags size={16} />}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="CASH">Kas</option>
            <option value="BANK">Bank</option>
            <option value="EWALLET">E-Wallet</option>
            <option value="CREDIT">Kartu Kredit</option>
            <option value="OTHER">Lainnya</option>
          </Select>
          <Input
            label="Saldo awal"
            type="number"
            icon={<Hash size={16} />}
            value={form.openingBalance}
            onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
          />
          <Input
            label="Warna aksen"
            type="color"
            icon={<Palette size={16} />}
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
          />
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full py-3">
            {busy ? "Menyimpan..." : editingId ? "Simpan perubahan" : "Simpan akun"}
          </Button>
        </form>
      </Modal>
    </Protected>
  );
}
