"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  RefreshCw,
  TrendingUp,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { Protected } from "@/components/Protected";
import { Badge, Button, Card, EmptyState, PageHeader, TableShell } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";

type Analytics = {
  summary: {
    usersTotal: number;
    usersActive: number;
    usersInactive: number;
    usersArchived: number;
    usersSuper: number;
    businessesTotal: number;
    transactionsTotal: number;
    signupsLast7: number;
    signupsPrev7: number;
    signupsDelta: number;
  };
  statusBreakdown: {
    active: number;
    inactive: number;
    archived: number;
    superadmin: number;
  };
  signupsByDay: Array<{ date: string; count: number }>;
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    isSuperAdmin: boolean;
    createdAt: string;
    businessCount: number;
    transactionCount: number;
  }>;
  topUsers: Array<{
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    transactionCount: number;
    activityCount: number;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    detail?: string | null;
    createdAt: string;
    user?: { name: string; email: string } | null;
    business?: { name: string } | null;
  }>;
};

export default function AdminAnalyticsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await api<Analytics>("/api/admin/analytics");
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat analytics");
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user?.isSuperAdmin) {
      router.replace("/dashboard");
      return;
    }
    void load();
  }, [user?.isSuperAdmin, loading, router, load]);

  const maxSignup = useMemo(
    () => Math.max(1, ...(data?.signupsByDay.map((d) => d.count) || [1])),
    [data?.signupsByDay]
  );

  const statusTotal = useMemo(() => {
    if (!data) return 1;
    const { active, inactive, archived } = data.statusBreakdown;
    return Math.max(1, active + inactive + archived);
  }, [data]);

  if (loading || !user?.isSuperAdmin) {
    return (
      <Protected>
        <p className="text-sm text-[var(--muted)]">Memuat analytics...</p>
      </Protected>
    );
  }

  const s = data?.summary;

  return (
    <Protected>
      <PageHeader
        title="Analytics pengguna"
        subtitle="Pertumbuhan registrasi, status akun, dan aktivitas pengguna di Catetrek."
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
          {
            label: "Total pengguna",
            value: s?.usersTotal ?? "—",
            hint: `${s?.usersActive ?? 0} aktif`,
            icon: Users,
          },
          {
            label: "Signup 7 hari",
            value: s?.signupsLast7 ?? "—",
            hint:
              (s?.signupsDelta ?? 0) >= 0
                ? `+${s?.signupsDelta ?? 0} vs minggu lalu`
                : `${s?.signupsDelta ?? 0} vs minggu lalu`,
            icon: UserPlus,
          },
          {
            label: "Nonaktif / arsip",
            value: `${s?.usersInactive ?? 0} / ${s?.usersArchived ?? 0}`,
            hint: `${s?.usersSuper ?? 0} superadmin`,
            icon: UserRound,
          },
          {
            label: "Transaksi platform",
            value: s?.transactionsTotal ?? "—",
            hint: `${s?.businessesTotal ?? 0} bisnis`,
            icon: TrendingUp,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {card.label}
                </p>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
                  <Icon size={15} />
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold">{card.value}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{card.hint}</p>
            </Card>
          );
        })}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <p className="text-sm font-semibold">Registrasi 30 hari terakhir</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Jumlah akun baru per hari</p>
          <div className="mt-5 flex h-40 items-end gap-1">
            {(data?.signupsByDay || []).map((d) => (
              <div key={d.date} className="group relative flex min-w-0 flex-1 flex-col items-center justify-end">
                <div
                  className="w-full rounded-t-md bg-[var(--brand)]/80 transition group-hover:bg-[var(--brand)]"
                  style={{ height: `${Math.max(4, (d.count / maxSignup) * 100)}%` }}
                  title={`${d.date}: ${d.count}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-[var(--muted)]">
            <span>{data?.signupsByDay[0]?.date || "—"}</span>
            <span>{data?.signupsByDay.at(-1)?.date || "—"}</span>
          </div>
        </Card>

        <Card>
          <p className="text-sm font-semibold">Status akun</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Komposisi pengguna</p>
          <ul className="mt-5 space-y-3">
            {(
              [
                ["Aktif", data?.statusBreakdown.active ?? 0, "bg-emerald-500"],
                ["Nonaktif", data?.statusBreakdown.inactive ?? 0, "bg-amber-500"],
                ["Arsip", data?.statusBreakdown.archived ?? 0, "bg-orange-500"],
              ] as const
            ).map(([label, count, color]) => (
              <li key={label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium">{label}</span>
                  <span className="text-[var(--muted)]">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--brand-soft)]">
                  <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: `${(count / statusTotal) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-[var(--muted)]">
            Superadmin aktif: <span className="font-semibold text-[var(--ink)]">{data?.statusBreakdown.superadmin ?? 0}</span>
          </p>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <div>
          <p className="mb-3 text-sm font-semibold">Pengguna paling aktif (transaksi)</p>
          {(data?.topUsers.length || 0) === 0 ? (
            <Card>
              <EmptyState title="Belum ada data" desc="Aktivitas transaksi akan muncul di sini." />
            </Card>
          ) : (
            <TableShell minWidth="28rem">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--brand-soft)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Pengguna</th>
                    <th className="px-4 py-3 font-semibold text-right">Tx</th>
                    <th className="px-4 py-3 font-semibold text-right">Log</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.topUsers.map((u) => (
                    <tr key={u.id} className="border-t border-[var(--line)]">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{u.name}</p>
                        <p className="text-xs text-[var(--muted)]">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{u.transactionCount}</td>
                      <td className="px-4 py-3 text-right text-[var(--muted)]">{u.activityCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold">Registrasi terbaru</p>
          {(data?.recentUsers.length || 0) === 0 ? (
            <Card>
              <EmptyState title="Belum ada pengguna" desc="Signup baru akan muncul di sini." />
            </Card>
          ) : (
            <TableShell minWidth="28rem">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--brand-soft)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Pengguna</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Gabung</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recentUsers.map((u) => (
                    <tr key={u.id} className="border-t border-[var(--line)]">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{u.name}</p>
                        <p className="text-xs text-[var(--muted)]">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={u.isActive ? "success" : "warning"}>
                            {u.isActive ? "Aktif" : "Nonaktif"}
                          </Badge>
                          {u.isSuperAdmin && <Badge tone="brand">SA</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--muted)]">
                        {formatDate(u.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </div>
      </div>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Activity size={16} className="text-[var(--brand)]" />
          <p className="text-sm font-semibold">Aktivitas terbaru</p>
        </div>
        {(data?.recentActivity.length || 0) === 0 ? (
          <EmptyState title="Belum ada log" desc="Aktivitas sistem akan muncul di sini." />
        ) : (
          <ul className="space-y-3">
            {data?.recentActivity.map((a) => (
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
    </Protected>
  );
}
