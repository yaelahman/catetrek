import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categoriesSeed = [
  { name: "Penjualan Jasa", type: "INCOME" as const, color: "#059669", icon: "store" },
  { name: "Penjualan Produk", type: "INCOME" as const, color: "#10B981", icon: "box" },
  { name: "Pendapatan Lain", type: "INCOME" as const, color: "#14B8A6", icon: "plus" },
  { name: "Pembelian Stok", type: "EXPENSE" as const, color: "#DC2626", icon: "box" },
  { name: "Operasional", type: "EXPENSE" as const, color: "#EA580C", icon: "settings" },
  { name: "Gaji Karyawan", type: "EXPENSE" as const, color: "#D97706", icon: "users" },
  { name: "Sewa & Utilitas", type: "EXPENSE" as const, color: "#7C3AED", icon: "home" },
  { name: "Pemasaran", type: "EXPENSE" as const, color: "#2563EB", icon: "megaphone" },
  { name: "Transportasi", type: "EXPENSE" as const, color: "#0891B2", icon: "truck" },
  { name: "Pajak", type: "EXPENSE" as const, color: "#4B5563", icon: "receipt" },
];

function d(year: number, month: number, day: number, hour = 10) {
  // month: 1-12
  return new Date(year, month - 1, day, hour, 0, 0);
}

async function main() {
  const email = "yaelahman0810@gmail.com";
  const password = "Anjay123";

  console.log("Membersihkan data lama (jika ada)...");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const memberships = await prisma.membership.findMany({ where: { userId: existing.id } });
    for (const m of memberships) {
      await prisma.transaction.deleteMany({ where: { businessId: m.businessId } });
      await prisma.budget.deleteMany({ where: { businessId: m.businessId } });
      await prisma.debt.deleteMany({ where: { businessId: m.businessId } });
      await prisma.savingsContribution.deleteMany({ where: { businessId: m.businessId } });
      await prisma.savingsGoal.deleteMany({ where: { businessId: m.businessId } });
      await prisma.category.deleteMany({ where: { businessId: m.businessId } });
      await prisma.account.deleteMany({ where: { businessId: m.businessId } });
      await prisma.activityLog.deleteMany({ where: { businessId: m.businessId } });
      await prisma.membership.deleteMany({ where: { businessId: m.businessId } });
      await prisma.business.delete({ where: { id: m.businessId } });
    }
    await prisma.passwordResetToken.deleteMany({ where: { userId: existing.id } });
    await prisma.activityLog.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  console.log("Membuat user & bisnis Manzcode...");
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name: "Iman",
      email,
      passwordHash,
      isSuperAdmin: true,
      isActive: true,
    },
  });

  const business = await prisma.business.create({
    data: {
      name: "Manzcode",
      currency: "IDR",
      timezone: "Asia/Jakarta",
    },
  });

  await prisma.membership.create({
    data: {
      userId: user.id,
      businessId: business.id,
      role: "OWNER",
    },
  });

  const [kas, bank, ewallet] = await Promise.all([
    prisma.account.create({
      data: {
        name: "Kas Tunai",
        type: "CASH",
        color: "#0F766E",
        openingBalance: 2500000,
        businessId: business.id,
      },
    }),
    prisma.account.create({
      data: {
        name: "BCA Manzcode",
        type: "BANK",
        color: "#1D4ED8",
        openingBalance: 15000000,
        businessId: business.id,
      },
    }),
    prisma.account.create({
      data: {
        name: "GoPay Bisnis",
        type: "EWALLET",
        color: "#00AED6",
        openingBalance: 750000,
        businessId: business.id,
      },
    }),
  ]);

  const createdCategories = [];
  for (const c of categoriesSeed) {
    createdCategories.push(
      await prisma.category.create({
        data: { ...c, businessId: business.id },
      })
    );
  }

  const cat = Object.fromEntries(createdCategories.map((c) => [c.name, c]));

  const year = 2026;
  const month = 7; // Juli 2026

  console.log("Menambahkan transaksi laporan Juli 2026...");

  const julyTransactions: Array<{
    type: "INCOME" | "EXPENSE" | "TRANSFER";
    amount: number;
    date: Date;
    note: string;
    accountId?: string;
    categoryId?: string;
    transferFromId?: string;
    transferToId?: string;
  }> = [
    // Mingguan pemasukan jasa/produk
    { type: "INCOME", amount: 4500000, date: d(year, month, 1, 9), note: "Project website klien A", accountId: bank.id, categoryId: cat["Penjualan Jasa"].id },
    { type: "INCOME", amount: 850000, date: d(year, month, 2, 14), note: "Jual paket template UI", accountId: ewallet.id, categoryId: cat["Penjualan Produk"].id },
    { type: "EXPENSE", amount: 320000, date: d(year, month, 2, 16), note: "Domain & hosting VPS", accountId: bank.id, categoryId: cat["Operasional"].id },
    { type: "INCOME", amount: 2750000, date: d(year, month, 3, 11), note: "Maintenance sistem POS", accountId: bank.id, categoryId: cat["Penjualan Jasa"].id },
    { type: "EXPENSE", amount: 150000, date: d(year, month, 3, 18), note: "Iklan Instagram Ads", accountId: ewallet.id, categoryId: cat["Pemasaran"].id },
    { type: "EXPENSE", amount: 450000, date: d(year, month, 4, 10), note: "Beli keyboard & mouse stok", accountId: kas.id, categoryId: cat["Pembelian Stok"].id },
    { type: "INCOME", amount: 1200000, date: d(year, month, 5, 13), note: "Landing page UMKM", accountId: bank.id, categoryId: cat["Penjualan Jasa"].id },
    { type: "EXPENSE", amount: 2500000, date: d(year, month, 5, 9), note: "Gaji freelance developer", accountId: bank.id, categoryId: cat["Gaji Karyawan"].id },
    { type: "TRANSFER", amount: 1000000, date: d(year, month, 6, 8), note: "Tarik tunai operasional", transferFromId: bank.id, transferToId: kas.id },
    { type: "EXPENSE", amount: 1800000, date: d(year, month, 6, 12), note: "Sewa coworking space Juli", accountId: bank.id, categoryId: cat["Sewa & Utilitas"].id },
    { type: "INCOME", amount: 5600000, date: d(year, month, 7, 10), note: "Project aplikasi inventory", accountId: bank.id, categoryId: cat["Penjualan Jasa"].id },
    { type: "EXPENSE", amount: 95000, date: d(year, month, 7, 17), note: "Ojek antar dokumen klien", accountId: ewallet.id, categoryId: cat["Transportasi"].id },
    { type: "INCOME", amount: 650000, date: d(year, month, 8, 15), note: "Penjualan e-book coding", accountId: ewallet.id, categoryId: cat["Penjualan Produk"].id },
    { type: "EXPENSE", amount: 220000, date: d(year, month, 8, 19), note: "Listrik & internet kantor", accountId: bank.id, categoryId: cat["Sewa & Utilitas"].id },
    { type: "INCOME", amount: 3100000, date: d(year, month, 9, 11), note: "Integrasi payment gateway", accountId: bank.id, categoryId: cat["Penjualan Jasa"].id },
    { type: "EXPENSE", amount: 410000, date: d(year, month, 9, 16), note: "Boost Meta Ads Juli", accountId: bank.id, categoryId: cat["Pemasaran"].id },
    { type: "EXPENSE", amount: 175000, date: d(year, month, 10, 9), note: "Beli stok kabel & adapter", accountId: kas.id, categoryId: cat["Pembelian Stok"].id },
    { type: "INCOME", amount: 980000, date: d(year, month, 11, 14), note: "Training internal perusahaan", accountId: bank.id, categoryId: cat["Penjualan Jasa"].id },
    { type: "INCOME", amount: 500000, date: d(year, month, 12, 10), note: "Komisi affiliate tools", accountId: ewallet.id, categoryId: cat["Pendapatan Lain"].id },
    { type: "EXPENSE", amount: 125000, date: d(year, month, 12, 18), note: "Bensin meeting klien", accountId: kas.id, categoryId: cat["Transportasi"].id },
    { type: "INCOME", amount: 4200000, date: d(year, month, 13, 9), note: "DP project ERP mini", accountId: bank.id, categoryId: cat["Penjualan Jasa"].id },
    { type: "EXPENSE", amount: 2500000, date: d(year, month, 13, 11), note: "Gaji tim support", accountId: bank.id, categoryId: cat["Gaji Karyawan"].id },
    { type: "EXPENSE", amount: 350000, date: d(year, month, 14, 8), note: "Langganan Figma & Notion", accountId: bank.id, categoryId: cat["Operasional"].id },
    { type: "INCOME", amount: 1750000, date: d(year, month, 14, 15), note: "Custom dashboard analytics", accountId: bank.id, categoryId: cat["Penjualan Jasa"].id },
    { type: "EXPENSE", amount: 275000, date: d(year, month, 14, 16), note: "PPh 23 estimasi Juli (cicilan)", accountId: bank.id, categoryId: cat["Pajak"].id },
  ];

  for (const tx of julyTransactions) {
    await prisma.transaction.create({
      data: {
        type: tx.type,
        amount: tx.amount,
        date: tx.date,
        note: tx.note,
        businessId: business.id,
        accountId: tx.accountId ?? null,
        categoryId: tx.categoryId ?? null,
        transferFromId: tx.transferFromId ?? null,
        transferToId: tx.transferToId ?? null,
        createdById: user.id,
      },
    });
  }

  console.log("Menambahkan anggaran Juli 2026...");
  const budgets = [
    { categoryId: cat["Operasional"].id, amount: 1500000 },
    { categoryId: cat["Pemasaran"].id, amount: 1000000 },
    { categoryId: cat["Gaji Karyawan"].id, amount: 6000000 },
    { categoryId: cat["Sewa & Utilitas"].id, amount: 2500000 },
    { categoryId: cat["Transportasi"].id, amount: 500000 },
    { categoryId: cat["Pembelian Stok"].id, amount: 1000000 },
  ];

  for (const b of budgets) {
    await prisma.budget.create({
      data: {
        ...b,
        month,
        year,
        businessId: business.id,
      },
    });
  }

  console.log("Menambahkan hutang & piutang...");
  await prisma.debt.createMany({
    data: [
      {
        type: "RECEIVABLE",
        partyName: "PT Sinar Digital",
        amount: 3500000,
        paidAmount: 1000000,
        status: "PARTIAL",
        dueDate: d(year, month, 25),
        note: "Sisa invoice project website",
        businessId: business.id,
      },
      {
        type: "RECEIVABLE",
        partyName: "CV Maju Jaya",
        amount: 1500000,
        paidAmount: 0,
        status: "UNPAID",
        dueDate: d(year, month, 20),
        note: "Tagihan maintenance Juni-Juli",
        businessId: business.id,
      },
      {
        type: "PAYABLE",
        partyName: "Vendor Hosting CloudID",
        amount: 900000,
        paidAmount: 0,
        status: "UNPAID",
        dueDate: d(year, month, 18),
        note: "Biaya server tahunan cicilan 1",
        businessId: business.id,
      },
      {
        type: "PAYABLE",
        partyName: "Kredit Motor Dealer XYZ",
        amount: 13000000,
        paidAmount: 1000000,
        status: "PARTIAL",
        dueDate: d(year, month, 10),
        startDate: d(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1, 10),
        installmentCount: 13,
        installmentPaid: 1,
        note: "Cicilan 13x — contoh multi-periode",
        businessId: business.id,
      },
    ],
  });

  console.log("Menambahkan tabungan target...");
  const travelGoal = await prisma.savingsGoal.create({
    data: {
      name: "Liburan Bali Q3",
      targetAmount: 8000000,
      currentAmount: 2500000,
      deadline: d(year, 9, 30),
      category: "TRAVEL",
      color: "#0891B2",
      note: "Tiket + hotel 5 malam",
      businessId: business.id,
      status: "ACTIVE",
    },
  });
  const laptopGoal = await prisma.savingsGoal.create({
    data: {
      name: "Laptop Kerja Baru",
      targetAmount: 18000000,
      currentAmount: 6500000,
      deadline: d(year, 12, 15),
      category: "PURCHASE",
      color: "#0F766E",
      note: "Upgrade MacBook untuk development",
      businessId: business.id,
      status: "ACTIVE",
    },
  });
  await prisma.savingsContribution.createMany({
    data: [
      {
        goalId: travelGoal.id,
        amount: 1500000,
        date: d(year, month, 3),
        note: "Setoran awal",
        accountId: bank.id,
        businessId: business.id,
      },
      {
        goalId: travelGoal.id,
        amount: 1000000,
        date: d(year, month, 10),
        note: "Bonus project",
        accountId: ewallet.id,
        businessId: business.id,
      },
      {
        goalId: laptopGoal.id,
        amount: 4000000,
        date: d(year, month, 5),
        note: "DP dari profit Juni",
        accountId: bank.id,
        businessId: business.id,
      },
      {
        goalId: laptopGoal.id,
        amount: 2500000,
        date: d(year, month, 12),
        note: "Setoran rutin",
        accountId: bank.id,
        businessId: business.id,
      },
    ],
  });

  await prisma.activityLog.create({
    data: {
      action: "SEED",
      detail: "Database di-seed akun Iman / Manzcode + laporan Juli 2026 + tabungan target",
      userId: user.id,
      businessId: business.id,
    },
  });

  const income = julyTransactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const expense = julyTransactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);

  console.log("\nSeeder selesai!");
  console.log("────────────────────────────");
  console.log("Nama     : Iman");
  console.log("Bisnis   : Manzcode");
  console.log("Email    :", email);
  console.log("Password :", password);
  console.log("────────────────────────────");
  console.log(`Transaksi Juli 2026 : ${julyTransactions.length} record`);
  console.log(`Pemasukan           : Rp ${income.toLocaleString("id-ID")}`);
  console.log(`Pengeluaran         : Rp ${expense.toLocaleString("id-ID")}`);
  console.log(`Net                 : Rp ${(income - expense).toLocaleString("id-ID")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
