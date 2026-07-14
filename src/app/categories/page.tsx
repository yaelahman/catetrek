"use client";

import { FormEvent, useCallback, useState } from "react";
import { Plus, Palette, Tags } from "lucide-react";
import { Protected } from "@/components/Protected";
import { Badge, Button, EmptyState, Input, Modal, PageHeader, Select } from "@/components/ui";
import { api } from "@/lib/api";
import { confirm, toast } from "@/lib/alert";
import { useRealtimeRefresh } from "@/lib/socket";

type Category = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  color: string;
  isActive: boolean;
  children?: Category[];
};

type CategoryForm = { name: string; type: "INCOME" | "EXPENSE"; color: string };

const emptyForm: CategoryForm = { name: "", type: "EXPENSE", color: "#64748B" };

export default function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setItems(await api<Category[]>("/api/categories"));
  }, []);

  useRealtimeRefresh(load);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setOpen(true);
  }

  function openEdit(c: Category) {
    setEditingId(c.id);
    setForm({ name: c.name, type: c.type, color: c.color });
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
    setError("");
    try {
      if (editingId) {
        await api(`/api/categories/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({ name: form.name, color: form.color }),
        });
      } else {
        await api("/api/categories", { method: "POST", body: JSON.stringify(form) });
      }
      closeModal();
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    }
  }

  async function deactivate(id: string) {
    if (
      !(await confirm({
        title: "Nonaktifkan kategori?",
        message: "Kategori tidak akan muncul di form transaksi baru, tetapi data lama tetap aman.",
        confirmText: "Ya, nonaktifkan",
        tone: "warning",
      }))
    )
      return;
    await api(`/api/categories/${id}`, { method: "DELETE" });
    toast({ title: "Nonaktif", message: "Kategori berhasil dinonaktifkan.", tone: "success" });
    await load();
  }

  return (
    <Protected>
      <PageHeader
        title="Kategori"
        subtitle="Kelompokkan pemasukan dan pengeluaran agar laporan lebih jelas."
        action={
          <Button onClick={openCreate}>
            <Plus size={16} /> Tambah
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState title="Belum ada kategori" desc="Tambah kategori untuk mengklasifikasikan transaksi." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-white px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-full" style={{ background: c.color }} />
                <div>
                  <p className="font-medium">{c.name}</p>
                  <Badge tone={c.type === "INCOME" ? "success" : "danger"}>{c.type}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" onClick={() => openEdit(c)}>
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => deactivate(c.id)}>
                  {c.isActive ? "Nonaktifkan" : "Nonaktif"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={closeModal} title={editingId ? "Edit kategori" : "Tambah kategori"}>
        <form onSubmit={onSubmit} className="stagger space-y-3.5">
          <Input
            label="Nama kategori"
            required
            icon={<Tags size={16} />}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Select
            label="Tipe"
            icon={<Tags size={16} />}
            value={form.type}
            disabled={!!editingId}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as "INCOME" | "EXPENSE" })
            }
          >
            <option value="INCOME">Pemasukan</option>
            <option value="EXPENSE">Pengeluaran</option>
          </Select>
          <Input
            label="Warna"
            type="color"
            icon={<Palette size={16} />}
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
          />
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <Button type="submit" className="w-full py-3">
            {editingId ? "Simpan perubahan" : "Simpan kategori"}
          </Button>
        </form>
      </Modal>
    </Protected>
  );
}
