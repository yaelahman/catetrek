"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArchiveRestore,
  KeyRound,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { Protected } from "@/components/Protected";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  TableShell,
} from "@/components/ui";
import { api } from "@/lib/api";
import { confirm, toast } from "@/lib/alert";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  deletedAt?: string | null;
  createdAt: string;
  businesses: Array<{ id: string; name: string; role: string }>;
  transactionCount: number;
};

export default function AdminUsersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    isActive: true,
    isSuperAdmin: false,
  });
  const [pwdForm, setPwdForm] = useState({ newPassword: "", confirmPassword: "" });
  const [editBusy, setEditBusy] = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const usersQs = new URLSearchParams();
      if (q.trim()) usersQs.set("q", q.trim());
      if (includeDeleted) usersQs.set("includeDeleted", "1");
      const usersPath = `/api/admin/users${usersQs.toString() ? `?${usersQs}` : ""}`;
      const us = await api<AdminUser[]>(usersPath);
      setUsers(us);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat pengguna");
    }
  }, [q, includeDeleted]);

  useEffect(() => {
    if (loading) return;
    if (!user?.isSuperAdmin) {
      router.replace("/dashboard");
      return;
    }
    void load();
  }, [user?.isSuperAdmin, loading, router, load]);

  function openEdit(u: AdminUser) {
    setEditing(u);
    setEditForm({
      name: u.name,
      email: u.email,
      isActive: u.isActive,
      isSuperAdmin: u.isSuperAdmin,
    });
    setEditOpen(true);
  }

  function openPassword(u: AdminUser) {
    setEditing(u);
    setPwdForm({ newPassword: "", confirmPassword: "" });
    setPwdOpen(true);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditBusy(true);
    try {
      await api(`/api/admin/users/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      toast({ title: "Tersimpan", message: "Data pengguna diperbarui.", tone: "success" });
      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast({
        title: "Gagal",
        message: err instanceof Error ? err.message : "Gagal update",
        tone: "danger",
      });
    } finally {
      setEditBusy(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      toast({ title: "Tidak cocok", message: "Konfirmasi password harus sama.", tone: "warning" });
      return;
    }
    if (pwdForm.newPassword.length < 8) {
      toast({ title: "Terlalu pendek", message: "Password minimal 8 karakter.", tone: "warning" });
      return;
    }
    setPwdBusy(true);
    try {
      await api(`/api/admin/users/${editing.id}/password`, {
        method: "POST",
        body: JSON.stringify(pwdForm),
      });
      toast({ title: "Password diubah", message: `Password baru untuk ${editing.email} disimpan.`, tone: "success" });
      setPwdOpen(false);
      setEditing(null);
      setPwdForm({ newPassword: "", confirmPassword: "" });
    } catch (err) {
      toast({
        title: "Gagal",
        message: err instanceof Error ? err.message : "Gagal ubah password",
        tone: "danger",
      });
    } finally {
      setPwdBusy(false);
    }
  }

  async function softDeleteUser(u: AdminUser) {
    if (u.id === user?.id) return;
    if (
      !(await confirm({
        title: "Arsipkan pengguna?",
        message: `${u.name} (${u.email}) tidak bisa login lagi sampai dipulihkan.`,
        confirmText: "Ya, arsipkan",
        tone: "danger",
      }))
    )
      return;
    setBusyId(u.id);
    try {
      await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
      toast({ title: "Diarsipkan", message: "Pengguna berhasil diarsipkan.", tone: "success" });
      await load();
    } catch (err) {
      toast({
        title: "Gagal",
        message: err instanceof Error ? err.message : "Gagal arsipkan",
        tone: "danger",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function restoreUser(u: AdminUser) {
    setBusyId(u.id);
    try {
      await api(`/api/admin/users/${u.id}/restore`, { method: "POST" });
      toast({ title: "Dipulihkan", message: "Pengguna bisa login lagi.", tone: "success" });
      await load();
    } catch (err) {
      toast({
        title: "Gagal",
        message: err instanceof Error ? err.message : "Gagal pulihkan",
        tone: "danger",
      });
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !user?.isSuperAdmin) {
    return (
      <Protected>
        <p className="text-sm text-[var(--muted)]">Memuat pengguna...</p>
      </Protected>
    );
  }

  return (
    <Protected>
      <PageHeader
        title="Users"
        subtitle="Kelola akun pengguna platform: edit, ubah password, arsipkan, atau pulihkan."
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

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 pb-2 text-xs font-semibold text-[var(--muted)]">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => setIncludeDeleted(e.target.checked)}
            className="rounded border-[var(--line)]"
          />
          Tampilkan arsip
        </label>
        <div className="ml-auto w-full max-w-sm">
          <Input
            label="Cari nama / email"
            icon={<Search size={16} />}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load();
            }}
          />
        </div>
      </div>

      {users.length === 0 ? (
        <div className="rounded-[1.35rem] border border-[var(--line)] bg-white p-6 dark:bg-[var(--bg-elevated)]">
          <EmptyState title="Tidak ada pengguna" desc="Coba ubah kata kunci pencarian." />
        </div>
      ) : (
        <TableShell minWidth="56rem">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--brand-soft)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Pengguna</th>
                <th className="px-4 py-3 font-semibold">Bisnis</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Bergabung</th>
                <th className="px-4 py-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const archived = Boolean(u.deletedAt);
                return (
                  <tr
                    key={u.id}
                    className={`border-t border-[var(--line)] ${archived ? "opacity-70" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                          <UserRound size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold">{u.name}</p>
                          <p className="text-xs text-[var(--muted)]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-[var(--muted)]">
                        {u.businesses.length
                          ? u.businesses.map((b) => `${b.name} (${b.role})`).join(", ")
                          : "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {archived ? (
                          <Badge tone="danger">Arsip</Badge>
                        ) : (
                          <Badge tone={u.isActive ? "success" : "warning"}>
                            {u.isActive ? "Aktif" : "Nonaktif"}
                          </Badge>
                        )}
                        {u.isSuperAdmin && <Badge tone="brand">Superadmin</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--muted)]">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {archived ? (
                        <Button
                          variant="ghost"
                          disabled={busyId === u.id}
                          onClick={() => void restoreUser(u)}
                        >
                          <ArchiveRestore size={14} /> Pulihkan
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            disabled={busyId === u.id}
                            onClick={() => openEdit(u)}
                          >
                            <Pencil size={14} /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={busyId === u.id}
                            onClick={() => openPassword(u)}
                          >
                            <KeyRound size={14} /> Password
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={busyId === u.id || u.id === user.id}
                            onClick={() => void softDeleteUser(u)}
                          >
                            <Trash2 size={14} /> Arsipkan
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      )}

      <Modal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditing(null);
        }}
        title={`Edit pengguna${editing ? `: ${editing.name}` : ""}`}
      >
        <form onSubmit={saveEdit} className="stagger space-y-3.5">
          <Input
            label="Nama"
            required
            icon={<UserRound size={16} />}
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            required
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
          />
          <Select
            label="Status akun"
            value={editForm.isActive ? "1" : "0"}
            onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === "1" })}
            disabled={editing?.id === user.id}
          >
            <option value="1">Aktif</option>
            <option value="0">Nonaktif</option>
          </Select>
          <Select
            label="Peran platform"
            value={editForm.isSuperAdmin ? "1" : "0"}
            onChange={(e) => setEditForm({ ...editForm, isSuperAdmin: e.target.value === "1" })}
            disabled={editing?.id === user.id}
          >
            <option value="0">Pengguna biasa</option>
            <option value="1">Superadmin</option>
          </Select>
          <Button type="submit" disabled={editBusy} className="w-full py-3">
            {editBusy ? "Menyimpan..." : "Simpan perubahan"}
          </Button>
        </form>
      </Modal>

      <Modal
        open={pwdOpen}
        onClose={() => {
          setPwdOpen(false);
          setEditing(null);
          setPwdForm({ newPassword: "", confirmPassword: "" });
        }}
        title={`Ubah password${editing ? `: ${editing.name}` : ""}`}
      >
        <form onSubmit={savePassword} className="stagger space-y-3.5">
          <p className="text-sm text-[var(--muted)]">
            Password lama tidak diperlukan. Pengguna langsung bisa login dengan password baru.
          </p>
          <Input
            label="Password baru"
            type="password"
            required
            minLength={8}
            icon={<KeyRound size={16} />}
            value={pwdForm.newPassword}
            onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
            autoComplete="new-password"
          />
          <Input
            label="Konfirmasi password"
            type="password"
            required
            minLength={8}
            value={pwdForm.confirmPassword}
            onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
            autoComplete="new-password"
          />
          <Button type="submit" disabled={pwdBusy} className="w-full py-3">
            {pwdBusy ? "Menyimpan..." : "Simpan password"}
          </Button>
        </form>
      </Modal>
    </Protected>
  );
}
