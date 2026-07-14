import { Router } from "express";
import { prisma } from "../utils/prisma";
import { ok } from "../utils/response";
import { requireAuth, requireBusiness } from "../middleware/auth";
import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  eachDayOfInterval,
  format,
} from "date-fns";

const router = Router();
router.use(requireAuth, requireBusiness);

async function sumByType(businessId: string, type: "INCOME" | "EXPENSE", start: Date, end: Date) {
  const result = await prisma.transaction.aggregate({
    where: { businessId, type, date: { gte: start, lte: end }, deletedAt: null },
    _sum: { amount: true },
  });
  return Number(result._sum.amount || 0);
}

router.get("/", async (req, res) => {
  const businessId = req.businessId!;
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);
  const prevStart = startOfMonth(subMonths(now, 1));
  const prevEnd = endOfMonth(subMonths(now, 1));

  const [
    incomeMonth,
    expenseMonth,
    incomeYear,
    expenseYear,
    incomePrev,
    expensePrev,
    recent,
    accounts,
    budgets,
    upcomingDebts,
    savingsGoals,
  ] = await Promise.all([
    sumByType(businessId, "INCOME", monthStart, monthEnd),
    sumByType(businessId, "EXPENSE", monthStart, monthEnd),
    sumByType(businessId, "INCOME", yearStart, yearEnd),
    sumByType(businessId, "EXPENSE", yearStart, yearEnd),
    sumByType(businessId, "INCOME", prevStart, prevEnd),
    sumByType(businessId, "EXPENSE", prevStart, prevEnd),
    prisma.transaction.findMany({
      where: { businessId, deletedAt: null },
      include: { account: true, category: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.account.findMany({ where: { businessId, isActive: true } }),
    prisma.budget.findMany({
      where: { businessId, month: now.getMonth() + 1, year: now.getFullYear() },
      include: { category: true },
    }),
    prisma.debt.findMany({
      where: {
        businessId,
        deletedAt: null,
        status: { in: ["UNPAID", "PARTIAL"] },
        dueDate: { lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.savingsGoal.findMany({
      where: { businessId, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
  ]);

  const accountBalances = await Promise.all(
    accounts.map(async (account) => {
      const income = await prisma.transaction.aggregate({
        where: { businessId, accountId: account.id, type: "INCOME", deletedAt: null },
        _sum: { amount: true },
      });
      const expense = await prisma.transaction.aggregate({
        where: { businessId, accountId: account.id, type: "EXPENSE", deletedAt: null },
        _sum: { amount: true },
      });
      const transferIn = await prisma.transaction.aggregate({
        where: { businessId, transferToId: account.id, type: "TRANSFER", deletedAt: null },
        _sum: { amount: true },
      });
      const transferOut = await prisma.transaction.aggregate({
        where: { businessId, transferFromId: account.id, type: "TRANSFER", deletedAt: null },
        _sum: { amount: true },
      });
      const balance =
        Number(account.openingBalance) +
        Number(income._sum.amount || 0) -
        Number(expense._sum.amount || 0) +
        Number(transferIn._sum.amount || 0) -
        Number(transferOut._sum.amount || 0);
      return {
        ...account,
        openingBalance: Number(account.openingBalance),
        balance: Math.round(balance * 100) / 100,
      };
    })
  );

  const totalBalance = accountBalances.reduce((s, a) => s + a.balance, 0);

  const chartEnd = now > monthEnd ? monthEnd : now;
  const days = eachDayOfInterval({ start: monthStart, end: chartEnd });
  const chart = await Promise.all(
    days.map(async (day) => {
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
      const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
      const [inc, exp] = await Promise.all([
        sumByType(businessId, "INCOME", start, end),
        sumByType(businessId, "EXPENSE", start, end),
      ]);
      return { date: format(start, "yyyy-MM-dd"), income: inc, expense: exp };
    })
  );

  const budgetAlerts = await Promise.all(
    budgets.map(async (b) => {
      const spent = await prisma.transaction.aggregate({
        where: {
          businessId,
          categoryId: b.categoryId,
          type: "EXPENSE",
          deletedAt: null,
          date: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      });
      const spentAmount = Number(spent._sum.amount || 0);
      const budgetAmt = Number(b.amount);
      const percent = budgetAmt > 0 ? (spentAmount / budgetAmt) * 100 : 0;
      return {
        ...b,
        amount: budgetAmt,
        spent: spentAmount,
        remaining: budgetAmt - spentAmount,
        percent,
        alert: percent >= 80,
      };
    })
  );

  return ok(res, {
    totalBalance,
    accounts: accountBalances,
    month: {
      income: incomeMonth,
      expense: expenseMonth,
      net: incomeMonth - expenseMonth,
    },
    year: {
      income: incomeYear,
      expense: expenseYear,
      net: incomeYear - expenseYear,
    },
    previousMonth: {
      income: incomePrev,
      expense: expensePrev,
      net: incomePrev - expensePrev,
    },
    recentTransactions: recent.map((t) => ({ ...t, amount: Number(t.amount) })),
    chart,
    budgetAlerts: budgetAlerts.filter((b) => b.alert),
    upcomingDebts: upcomingDebts.map((d) => ({
      ...d,
      amount: Number(d.amount),
      paidAmount: Number(d.paidAmount),
    })),
    savingsGoals: savingsGoals.map((g) => {
      const target = Number(g.targetAmount);
      const current = Number(g.currentAmount);
      return {
        ...g,
        targetAmount: target,
        currentAmount: current,
        percent: target > 0 ? Math.min(100, (current / target) * 100) : 0,
        remaining: Math.max(0, target - current),
      };
    }),
  });
});

export default router;
