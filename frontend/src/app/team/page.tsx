"use client";

import { FormEvent, useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { Protected } from "@/components/Protected";
import { Badge, Button, EmptyState, Input, Modal, PageHeader, Select } from "@/components/ui";
import { api } from "@/lib/api";
import { confirm, toast } from "@/lib/alert";
import { useAuth } from "@/lib/auth";
import { useRealtimeRefresh } from "@/lib/socket";
import { Lock, Mail, Shield, UserRound } from "lucide-react";

type Member = {
  id: string;
  role: "OWNER" | "ADMIN" | "STAFF";
  user: { id: string; name: string; email: string };
};

export default function TeamPage() {
  const { business } = useAuth();
  const [items, setItems] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "STAFF",
  });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!business?.id) return;
    setItems(await api<Member[]>(`/api/businesses/${business.id}/members`));
  }, [business?.id]);

  useRealtimeRefresh(load);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!business?.id) return;
    setError("");
    try {
      await api(`/api/businesses/${business.id}/members`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setOpen(false);
      setForm({ email: "", name: "", password: "", role: "STAFF" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    }
  }

  async function remove(id: string) {
    if (!business?.id) return;
    if (
      !(await confirm({
        title: "Hapus anggota?",
        message: "Anggota ini tidak akan lagi bisa mengakses bisnis Anda.",
        confirmText: "Ya, hapus",
        tone: "danger",
      }))
    )
      return;
    await api(`/api/businesses/${business.id}/members/${id}`, { method: "DELETE" });
    toast({ title: "Terhapus", message: "Anggota berhasil dihapus.", tone: "success" });
    await load();
  }

  const canManage = business?.role === "OWNER" || business?.role === "ADMIN";

  return (
    <Protected>
      <PageHeader
        title="Tim"
        subtitle="Undang karyawan/admin agar bisa mencatat transaksi bersama secara realtime."
        action={
          canManage ? (
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} /> Undang anggota
            </Button>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState title="Belum ada anggota" desc="Undang tim untuk kolaborasi pencatatan." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--brand-soft)]/60 text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3 font-medium">{m.user.name}</td>
                  <td className="px-4 py-3">{m.user.email}</td>
                  <td className="px-4 py-3">
                    <Badge tone="brand">{m.role}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage && m.role !== "OWNER" && (
                      <Button variant="ghost" onClick={() => remove(m.id)}>
                        Hapus
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Undang anggota">
        <form onSubmit={onSubmit} className="stagger space-y-3.5">
          <Input
            label="Email"
            required
            type="email"
            icon={<Mail size={16} />}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Nama (jika user baru)"
            icon={<UserRound size={16} />}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Password sementara"
            type="password"
            minLength={8}
            icon={<Lock size={16} />}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            hint="Wajib diisi jika email belum terdaftar"
          />
          <Select
            label="Role"
            icon={<Shield size={16} />}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="STAFF">STAFF</option>
            <option value="ADMIN">ADMIN</option>
          </Select>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <Button type="submit" className="w-full py-3">
            Undang anggota
          </Button>
        </form>
      </Modal>
    </Protected>
  );
}
