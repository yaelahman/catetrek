"use client";

import { useCallback, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  LineChart,
  PiggyBank,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Protected } from "@/components/Protected";
import { Badge, Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { cn, formatDate, formatIDR } from "@/lib/format";
import { useRealtimeRefresh } from "@/lib/socket";

type DashboardData = {
  totalBalance: number;
  accounts: Array<{ id: string; name: string; balance: number; color: string }>;
  month: { income: number; expense: number; net: number };
  previousMonth: { income: number; expense: number; net: number };
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    date: string;
    note?: string | null;
    category?: { name: string; color: string } | null;
    account?: { name: string } | null;
  }>;
  chart: Array<{ date: string; income: number; expense: number }>;
  budgetAlerts: Array<{ category: { name: string }; percent: number; spent: number; amount: number }>;
  upcomingDebts: Array<{
    id: string;
    partyName: string;
    type: string;
    amount: number;
    paidAmount: number;
    dueDate?: string;
  }>;
  savingsGoals: Array<{
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    percent: number;
    remaining: number;
    color: string;
    category: string;
  }>;
};

function SectionTitle({
  icon,
  title,
  action,
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          {icon}
        </span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<DashboardData>("/api/dashboard");
      setData(d);
    } catch {
      setData(null);
    }
  }, []);

  useRealtimeRefresh(load);

  const summary = data
    ? [
        {
          label: "Total Saldo",
          value: formatIDR(data.totalBalance),
          icon: Wallet,
          iconClass: "bg-[var(--brand-soft)] text-[var(--brand)]",
        },
        {
          label: "Pemasukan Bulan Ini",
          value: formatIDR(data.month.income),
          icon: ArrowDownLeft,
          iconClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
        },
        {
          label: "Pengeluaran Bulan Ini",
          value: formatIDR(data.month.expense),
          icon: ArrowUpRight,
          iconClass: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
        },
        {
          label: "Laba Bersih Bulan Ini",
          value: formatIDR(data.month.net),
          icon: TrendingUp,
          iconClass: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
        },
      ]
    : [];

  return (
    <Protected>
      <PageHeader
        title="Dashboard"
        subtitle="Ringkasan keuangan usaha hari ini — update otomatis tanpa reload."
      />

      {!data ? (
        <p className="text-[var(--muted)]">Memuat dashboard...</p>
      ) : (
        <div className="space-y-6">
          <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summary.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.label} className="animate-fade-up !bg-white dark:!bg-[var(--bg-elevated)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-[var(--muted)]">{item.label}</p>
                      <p className="mt-2 text-2xl font-bold tracking-tight">{item.value}</p>
                    </div>
                    <span className={cn("grid h-11 w-11 place-items-center rounded-2xl", item.iconClass)}>
                      <Icon size={20} strokeWidth={2.1} />
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2 !bg-white dark:!bg-[var(--bg-elevated)]">
              <SectionTitle
                icon={<LineChart size={18} />}
                title="Tren bulan ini"
                action={
                  <Badge tone="brand">
                    vs bulan lalu: {formatIDR(data.month.net - data.previousMonth.net)}
                  </Badge>
                }
              />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.chart}>
                    <defs>
                      <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0B5F56" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#0B5F56" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#D97706" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#D97706" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d7e3dd" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} hide />
                    <YAxis tick={{ fontSize: 11 }} width={70} />
                    <Tooltip formatter={(v) => formatIDR(Number(v))} />
                    <Area type="monotone" dataKey="income" stroke="#0B5F56" fill="url(#inc)" />
                    <Area type="monotone" dataKey="expense" stroke="#D97706" fill="url(#exp)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="!bg-white dark:!bg-[var(--bg-elevated)]">
              <SectionTitle icon={<Wallet size={18} />} title="Saldo akun" />
              <div className="space-y-3">
                {data.accounts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: a.color }} />
                      <span className="text-sm">{a.name}</span>
                    </div>
                    <span className="text-sm font-semibold">{formatIDR(a.balance)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="!bg-white dark:!bg-[var(--bg-elevated)]">
              <SectionTitle icon={<ArrowLeftRight size={18} />} title="Transaksi terbaru" />
              <div className="space-y-3">
                {data.recentTransactions.length === 0 && (
                  <p className="text-sm text-[var(--muted)]">Belum ada transaksi.</p>
                )}
                {data.recentTransactions.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between border-b border-[var(--line)] pb-3 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{t.category?.name || t.type}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {formatDate(t.date)} · {t.account?.name || "Transfer"}
                      </p>
                    </div>
                    <p
                      className={
                        t.type === "INCOME"
                          ? "font-semibold text-[var(--success)]"
                          : t.type === "EXPENSE"
                            ? "font-semibold text-[var(--danger)]"
                            : "font-semibold"
                      }
                    >
                      {t.type === "EXPENSE" ? "-" : t.type === "INCOME" ? "+" : ""}
                      {formatIDR(t.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <div className="space-y-4">
              <Card className="!bg-white dark:!bg-[var(--bg-elevated)]">
                <SectionTitle icon={<AlertTriangle size={18} />} title="Peringatan anggaran" />
                {data.budgetAlerts.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Tidak ada anggaran kritis.</p>
                ) : (
                  data.budgetAlerts.map((b, i) => (
                    <div key={i} className="mb-3">
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{b.category.name}</span>
                        <span>{Math.round(b.percent)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-amber-500"
                          style={{ width: `${Math.min(100, b.percent)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </Card>

              <Card className="!bg-white dark:!bg-[var(--bg-elevated)]">
                <SectionTitle icon={<CalendarClock size={18} />} title="Jatuh tempo 14 hari" />
                {data.upcomingDebts.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Tidak ada tagihan dekat.</p>
                ) : (
                  data.upcomingDebts.map((d) => (
                    <div key={d.id} className="mb-3 flex justify-between text-sm">
                      <div>
                        <p className="font-medium">{d.partyName}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {d.type === "PAYABLE" ? "Hutang" : "Piutang"}
                          {d.dueDate ? ` · ${formatDate(d.dueDate)}` : ""}
                        </p>
                      </div>
                      <p className="font-semibold">{formatIDR(d.amount - d.paidAmount)}</p>
                    </div>
                  ))
                )}
              </Card>

              <Card className="!bg-white dark:!bg-[var(--bg-elevated)]">
                <SectionTitle
                  icon={<PiggyBank size={18} />}
                  title="Tabungan target"
                  action={
                    <a href="/savings" className="text-xs font-semibold text-[var(--brand)] hover:underline">
                      Lihat semua
                    </a>
                  }
                />
                {!data.savingsGoals?.length ? (
                  <p className="text-sm text-[var(--muted)]">Belum ada target aktif.</p>
                ) : (
                  data.savingsGoals.map((g) => (
                    <div key={g.id} className="mb-3">
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-medium">{g.name}</span>
                        <span>{Math.round(g.percent)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, g.percent)}%`, background: g.color }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatIDR(g.currentAmount)} / {formatIDR(g.targetAmount)}
                      </p>
                    </div>
                  ))
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </Protected>
  );
}
