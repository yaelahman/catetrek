"use client";

import { FormEvent, useCallback, useState } from "react";
import { Package, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { Protected } from "@/components/Protected";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Modal,
  MoneyInput,
  PageHeader,
  Select,
  TableShell,
  TextArea,
} from "@/components/ui";
import { api } from "@/lib/api";
import { confirm, toast } from "@/lib/alert";
import { formatIDR } from "@/lib/format";
import { useRealtimeRefresh } from "@/lib/socket";

type Product = {
  id: string;
  name: string;
  sku?: string | null;
  price: number;
  stock?: number | null;
  unit: string;
  note?: string | null;
  isActive: boolean;
};

type ProductForm = {
  name: string;
  sku: string;
  price: string;
  stock: string;
  unit: string;
  note: string;
  trackStock: boolean;
};

const emptyForm: ProductForm = {
  name: "",
  sku: "",
  price: "",
  stock: "",
  unit: "pcs",
  note: "",
  trackStock: true,
};

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (includeInactive) params.set("includeInactive", "1");
    setItems(await api<Product[]>(`/api/products${params.toString() ? `?${params}` : ""}`));
  }, [q, includeInactive]);

  useRealtimeRefresh(load);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      sku: p.sku || "",
      price: String(p.price),
      stock: p.stock == null ? "" : String(p.stock),
      unit: p.unit || "pcs",
      note: p.note || "",
      trackStock: p.stock != null,
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
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        price: Number(form.price),
        stock: form.trackStock ? (form.stock === "" ? 0 : Number(form.stock)) : null,
        unit: form.unit.trim() || "pcs",
        note: form.note.trim() || null,
      };

      if (editingId) {
        await api(`/api/products/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast({ title: "Tersimpan", message: "Produk diperbarui.", tone: "success" });
      } else {
        await api("/api/products", { method: "POST", body: JSON.stringify(payload) });
        toast({ title: "Ditambahkan", message: "Produk baru siap dijual.", tone: "success" });
      }
      closeModal();
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal simpan");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(p: Product) {
    if (
      !(await confirm({
        title: p.isActive ? "Nonaktifkan produk?" : "Aktifkan produk?",
        message: p.isActive
          ? "Produk tidak muncul di form transaksi baru, riwayat penjualan tetap aman."
          : "Produk bisa dipilih lagi saat catat pemasukan.",
        confirmText: p.isActive ? "Ya, nonaktifkan" : "Ya, aktifkan",
        tone: p.isActive ? "warning" : "brand",
      }))
    )
      return;

    if (p.isActive) {
      await api(`/api/products/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      });
      toast({ title: "Nonaktif", message: "Produk dinonaktifkan.", tone: "success" });
    } else {
      await api(`/api/products/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: true }),
      });
      toast({ title: "Aktif", message: "Produk diaktifkan kembali.", tone: "success" });
    }
    await load();
  }

  async function hardDelete(p: Product) {
    if (
      !(await confirm({
        title: "Hapus produk?",
        message: "Hanya produk tanpa transaksi aktif yang bisa dihapus permanen.",
        confirmText: "Hapus",
        tone: "danger",
      }))
    )
      return;
    try {
      await api(`/api/products/${p.id}`, { method: "DELETE" });
      toast({ title: "Terhapus", message: "Produk dihapus / dinonaktifkan.", tone: "success" });
      await load();
    } catch (err) {
      toast({
        title: "Gagal",
        message: err instanceof Error ? err.message : "Gagal hapus",
        tone: "danger",
      });
    }
  }

  return (
    <Protected>
      <PageHeader
        title="Produk"
        subtitle="Kelola katalog barang/jasa siap jual. Pilih produk saat catat pemasukan penjualan."
        action={
          <Button onClick={openCreate}>
            <Plus size={16} /> Tambah produk
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-sm">
          <Input
            label="Cari nama / SKU"
            icon={<Search size={16} />}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load();
            }}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-xs font-semibold text-[var(--muted)]">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-[var(--line)]"
          />
          Tampilkan nonaktif
        </label>
        <Button variant="secondary" onClick={() => void load()}>
          Cari
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Belum ada produk"
          desc="Tambah produk (harga + stok opsional), lalu pilih saat mencatat pemasukan."
        />
      ) : (
        <TableShell minWidth="44rem">
          <table className="w-full text-left text-sm">
            <thead style={{ background: "var(--table-head)" }} className="text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3.5 font-semibold">Produk</th>
                <th className="px-4 py-3.5 font-semibold text-right">Harga</th>
                <th className="px-4 py-3.5 font-semibold text-right">Stok</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr
                  key={p.id}
                  className={`border-t border-[var(--line)]/70 ${p.isActive ? "" : "opacity-60"}`}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                        <Package size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {p.sku ? `SKU ${p.sku}` : "Tanpa SKU"}
                          {p.note ? ` · ${p.note}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold whitespace-nowrap">
                    {formatIDR(p.price)}
                    <span className="ml-1 text-xs font-normal text-[var(--muted)]">/{p.unit}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    {p.stock == null ? (
                      <span className="text-[var(--muted)]">—</span>
                    ) : (
                      <span className={p.stock <= 0 ? "font-semibold text-[var(--danger)]" : ""}>
                        {p.stock} {p.unit}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge tone={p.isActive ? "success" : "warning"}>
                      {p.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <Button variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil size={14} /> Edit
                    </Button>
                    <Button variant="ghost" onClick={() => void deactivate(p)}>
                      <Power size={14} /> {p.isActive ? "Nonaktif" : "Aktifkan"}
                    </Button>
                    <Button variant="ghost" onClick={() => void hardDelete(p)}>
                      <Trash2 size={14} /> Hapus
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}

      <Modal
        open={open}
        onClose={closeModal}
        title={editingId ? "Edit produk" : "Tambah produk"}
      >
        <form onSubmit={onSubmit} className="stagger space-y-3.5">
          <Input
            label="Nama produk"
            required
            icon={<Package size={16} />}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="SKU (opsional)"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
          />
          <MoneyInput
            label="Harga jual"
            required
            value={form.price}
            onValueChange={(raw) => setForm({ ...form, price: raw })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Satuan"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            >
              <option value="pcs">pcs</option>
              <option value="paket">paket</option>
              <option value="jam">jam</option>
              <option value="bulan">bulan</option>
              <option value="lisensi">lisensi</option>
            </Select>
            <div>
              <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={form.trackStock}
                  onChange={(e) => setForm({ ...form, trackStock: e.target.checked })}
                  className="rounded border-[var(--line)]"
                />
                Lacak stok
              </label>
              {form.trackStock && (
                <Input
                  label="Stok"
                  type="number"
                  min={0}
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              )}
            </div>
          </div>
          <TextArea
            label="Catatan (opsional)"
            rows={2}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          {error && (
            <p className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="w-full py-3">
            {busy ? "Menyimpan..." : editingId ? "Simpan perubahan" : "Simpan produk"}
          </Button>
        </form>
      </Modal>
    </Protected>
  );
}
