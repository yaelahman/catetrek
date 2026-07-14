"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  RefreshCw,
  Search,
  Shield,
  UserRound,
  Users,
} from "lucide-react";
import { Protected } from "@/components/Protected";
import { Badge, Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { toast } from "@/lib/alert";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";

type Overview = {
  stats: {
    usersTotal: number;
    usersActive: number;
    usersInactive: number;
    usersSuper: number;
    businessesTotal: number;
    membershipsTotal: number;
    transactionsTotal: number;
    debtsOpen: number;
    savingsActive: number;
  };
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  businesses: Array<{ id: string; name: string; role: string }>;
  transactionCount: number;
};

type AdminBusiness = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  createdAt: string;
  members: Array<{ role: string; user: { id: string; name: string; email: string; isActive: boolean } }>;
  counts: {
    accounts: number;
    transactions: number;
    categories: number;
    debts: number;
    savingsGoals: number;
  };
};

type Activity = {
  id: string;
  action: string;
  detail?: string | null;
  createdAt: string;
  user?: { name: string; email: string } | null;
  business?: { name: string } | null;
};

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<"users" | "businesses" | "activity">("users");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [ov, us, bs, act] = await Promise.all([
        api<Overview>("/api/admin/overview"),
        api<AdminUser[]>(`/api/admin/users${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`),
        api<AdminBusiness[]>(
          `/api/admin/businesses${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`
        ),
        api<Activity[]>("/api/admin/activity?limit=30"),
      ]);
      setOverview(ov);
      setUsers(us);
      setBusinesses(bs);
      setActivity(act);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data admin");
    }
  }, [q]);

  useEffect(() => {
    if (loading) return;
    if (!user?.isSuperAdmin) {
      router.replace("/dashboard");
      return;
    }
    void load();
  }, [user?.isSuperAdmin, loading, router, load]);

  async function patchUser(id: string, body: { isActive?: boolean; isSuperAdmin?: boolean }) {
    setBusyId(id);
    try {
      await api(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      toast({ title: "Tersimpan", message: "Status pengguna diperbarui.", tone: "success" });
      await load();
    } catch (err) {
      toast({
        title: "Gagal",
        message: err instanceof Error ? err.message : "Gagal update",
        tone: "danger",
      });
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !user?.isSuperAdmin) {
    return (
      <Protected>
        <p className="text-sm text-[var(--muted)]">Memuat panel admin...</p>
      </Protected>
    );
  }

  const stats = overview?.stats;

  return (
    <Protected>
      <PageHeader
        title="Super Admin"
        subtitle="Pantau pengguna, bisnis, dan aktivitas di seluruh platform Catetrek."
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

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Pengguna", value: stats?.usersTotal ?? "—", hint: `${stats?.usersActive ?? 0} aktif` },
          { label: "Bisnis", value: stats?.businessesTotal ?? "—", hint: `${stats?.membershipsTotal ?? 0} membership` },
          { label: "Transaksi", value: stats?.transactionsTotal ?? "—", hint: "aktif (non-arsip)" },
          { label: "Superadmin", value: stats?.usersSuper ?? "—", hint: `${stats?.debtsOpen ?? 0} hutang terbuka` },
        ].map((s) => (
          <Card key={s.label}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{s.label}</p>
            <p className="mt-2 text-3xl font-bold">{s.value}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{s.hint}</p>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["users", "Pengguna", Users],
            ["businesses", "Bisnis", Building2],
            ["activity", "Aktivitas", Shield],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              tab === id
                ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                : "border-[var(--line)] hover:bg-[var(--brand-soft)]"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
        {(tab === "users" || tab === "businesses") && (
          <div className="ml-auto w-full max-w-xs sm:w-64">
            <Input
              label="Cari"
              icon={<Search size={16} />}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load();
              }}
            />
          </div>
        )}
      </div>

      {tab === "users" && (
        <div className="overflow-hidden rounded-[1.35rem] border border-[var(--line)] bg-white dark:bg-[var(--bg-elevated)]">
          {users.length === 0 ? (
            <div className="p-6">
              <EmptyState title="Tidak ada pengguna" desc="Coba ubah kata kunci pencarian." />
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-[var(--line)]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                            <UserRound size={16} />
                          </span>
                          <div>
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
                          <Badge tone={u.isActive ? "success" : "danger"}>
                            {u.isActive ? "Aktif" : "Nonaktif"}
                          </Badge>
                          {u.isSuperAdmin && <Badge tone="brand">Superadmin</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--muted)]">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          disabled={busyId === u.id || u.id === user.id}
                          onClick={() => patchUser(u.id, { isActive: !u.isActive })}
                        >
                          {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busyId === u.id || (u.id === user.id && u.isSuperAdmin)}
                          onClick={() => patchUser(u.id, { isSuperAdmin: !u.isSuperAdmin })}
                        >
                          {u.isSuperAdmin ? "Cabut SA" : "Jadikan SA"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "businesses" && (
        <div className="overflow-hidden rounded-[1.35rem] border border-[var(--line)] bg-white dark:bg-[var(--bg-elevated)]">
          {businesses.length === 0 ? (
            <div className="p-6">
              <EmptyState title="Tidak ada bisnis" desc="Belum ada data bisnis terdaftar." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--brand-soft)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Bisnis</th>
                    <th className="px-4 py-3 font-semibold">Anggota</th>
                    <th className="px-4 py-3 font-semibold">Data</th>
                    <th className="px-4 py-3 font-semibold">Dibuat</th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.map((b) => (
                    <tr key={b.id} className="border-t border-[var(--line)]">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{b.name}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {b.currency} · {b.timezone}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-[var(--muted)]">
                          {b.members
                            .map((m) => `${m.user.name} (${m.role})`)
                            .join(", ") || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)]">
                        {b.counts.transactions} tx · {b.counts.accounts} akun · {b.counts.debts} hutang
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--muted)]">
                        {formatDate(b.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "activity" && (
        <Card>
          {activity.length === 0 ? (
            <EmptyState title="Belum ada log" desc="Aktivitas sistem akan muncul di sini." />
          ) : (
            <ul className="space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="border-b border-[var(--line)] pb-3 last:border-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{a.action}</p>
                    <p className="text-xs text-[var(--muted)]">{formatDate(a.createdAt)}</p>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">{a.detail || "—"}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {a.user ? `${a.user.name} · ${a.user.email}` : "Sistem"}
                    {a.business ? ` · ${a.business.name}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </Protected>
  );
}
