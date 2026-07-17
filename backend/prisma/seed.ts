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

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function d(year: number, month: number, day: number, hour = 10) {
  // month: 1-12 — clamp day ke akhir bulan agar aman
  const last = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(day, last), hour, 0, 0);
}

/** Pseudo-random deterministik per seed (reproducible). */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundMoney(n: number) {
  return Math.round(n / 1000) * 1000;
}

type TxSeed = {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  date: Date;
  note: string;
  accountId?: string;
  categoryId?: string;
  transferFromId?: string;
  transferToId?: string;
};

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
        data: { ...c, businessId: business.id, userId: user.id },
      })
    );
  }

  const cat = Object.fromEntries(createdCategories.map((c) => [c.name, c]));

  console.log("Menambahkan produk contoh...");
  await prisma.product.createMany({
    data: [
      {
        name: "Template UI Kit",
        sku: "PRD-UI-01",
        price: 850000,
        stock: 40,
        unit: "paket",
        note: "Paket komponen UI siap pakai",
        businessId: business.id,
      },
      {
        name: "E-book Coding UMKM",
        sku: "PRD-EB-01",
        price: 99000,
        stock: 200,
        unit: "pcs",
        note: "Panduan digital untuk pelaku usaha",
        businessId: business.id,
      },
      {
        name: "Paket Landing Page",
        sku: "PRD-LP-01",
        price: 1500000,
        stock: null,
        unit: "paket",
        note: "Jasa + template — stok tidak dilacak",
        businessId: business.id,
      },
      {
        name: "Retainer Support Bulanan",
        sku: "PRD-RS-01",
        price: 2500000,
        stock: null,
        unit: "bulan",
        note: "Layanan support & maintenance",
        businessId: business.id,
      },
    ],
  });

  // 12 bulan terakhir berakhir bulan berjalan (Juli 2026 → Agustus 2025 s/d Juli 2026)
  const end = new Date(2026, 6, 1); // Juli 2026
  const months: Array<{ year: number; month: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(end.getFullYear(), end.getMonth() - i, 1);
    months.push({ year: dt.getFullYear(), month: dt.getMonth() + 1 });
  }

  console.log(
    `Menambahkan transaksi dummy ${months[0].year}-${String(months[0].month).padStart(2, "0")} s/d ${months[11].year}-${String(months[11].month).padStart(2, "0")}...`
  );

  const allTx: TxSeed[] = [];
  const rand = mulberry32(20260718);

  const incomeNotes = [
    "Project website klien",
    "Maintenance sistem POS",
    "Landing page UMKM",
    "Integrasi payment gateway",
    "Custom dashboard analytics",
    "DP project ERP mini",
    "Training internal perusahaan",
    "Retainer support bulanan",
    "Project aplikasi inventory",
    "Redesign brand kit",
  ];
  const productNotes = [
    "Jual paket template UI",
    "Penjualan e-book coding",
    "Lisensi tema WordPress",
    "Paket starter kit UMKM",
  ];
  const otherIncomeNotes = ["Komisi affiliate tools", "Cashback layanan cloud", "Refund vendor"];

  for (let mi = 0; mi < months.length; mi++) {
    const { year, month } = months[mi];
    const label = MONTH_NAMES[month - 1];
    // Pertumbuhan lembut + musim (Q4 & awal tahun lebih ramai)
    const growth = 1 + mi * 0.035;
    const seasonal = month >= 10 || month <= 2 ? 1.12 : month >= 6 && month <= 8 ? 0.95 : 1;
    const factor = growth * seasonal;
    const r = () => rand();

    // ~4–6 pemasukan jasa
    const jasaCount = 4 + Math.floor(r() * 3);
    for (let i = 0; i < jasaCount; i++) {
      const day = 2 + Math.floor(r() * 24);
      const base = 900000 + r() * 4800000;
      allTx.push({
        type: "INCOME",
        amount: roundMoney(base * factor),
        date: d(year, month, day, 9 + Math.floor(r() * 6)),
        note: `${incomeNotes[Math.floor(r() * incomeNotes.length)]} — ${label}`,
        accountId: r() > 0.15 ? bank.id : ewallet.id,
        categoryId: cat["Penjualan Jasa"].id,
      });
    }

    // 1–2 produk
    const prodCount = 1 + Math.floor(r() * 2);
    for (let i = 0; i < prodCount; i++) {
      allTx.push({
        type: "INCOME",
        amount: roundMoney((350000 + r() * 900000) * factor),
        date: d(year, month, 5 + Math.floor(r() * 20), 14),
        note: `${productNotes[Math.floor(r() * productNotes.length)]} — ${label}`,
        accountId: ewallet.id,
        categoryId: cat["Penjualan Produk"].id,
      });
    }

    // Kadang pendapatan lain
    if (r() > 0.45) {
      allTx.push({
        type: "INCOME",
        amount: roundMoney(150000 + r() * 550000),
        date: d(year, month, 12 + Math.floor(r() * 10), 11),
        note: `${otherIncomeNotes[Math.floor(r() * otherIncomeNotes.length)]} — ${label}`,
        accountId: ewallet.id,
        categoryId: cat["Pendapatan Lain"].id,
      });
    }

    // Gaji (tetap naik pelan)
    allTx.push({
      type: "EXPENSE",
      amount: roundMoney((4500000 + mi * 80000) * (0.98 + r() * 0.06)),
      date: d(year, month, 5, 10),
      note: `Gaji tim & freelance — ${label}`,
      accountId: bank.id,
      categoryId: cat["Gaji Karyawan"].id,
    });

    // Sewa coworking
    allTx.push({
      type: "EXPENSE",
      amount: 1800000,
      date: d(year, month, 6, 9),
      note: `Sewa coworking space ${label}`,
      accountId: bank.id,
      categoryId: cat["Sewa & Utilitas"].id,
    });

    // Utilitas
    allTx.push({
      type: "EXPENSE",
      amount: roundMoney(180000 + r() * 120000),
      date: d(year, month, 8, 16),
      note: `Listrik & internet kantor — ${label}`,
      accountId: bank.id,
      categoryId: cat["Sewa & Utilitas"].id,
    });

    // Operasional tools
    allTx.push({
      type: "EXPENSE",
      amount: roundMoney(250000 + r() * 200000),
      date: d(year, month, 14, 10),
      note: `Langganan Figma, Notion, VPS — ${label}`,
      accountId: bank.id,
      categoryId: cat["Operasional"].id,
    });

    // Pemasaran
    allTx.push({
      type: "EXPENSE",
      amount: roundMoney((200000 + r() * 450000) * seasonal),
      date: d(year, month, 9 + Math.floor(r() * 10), 15),
      note: `Iklan Meta / Instagram Ads — ${label}`,
      accountId: r() > 0.5 ? bank.id : ewallet.id,
      categoryId: cat["Pemasaran"].id,
    });

    // Stok / hardware
    if (r() > 0.35) {
      allTx.push({
        type: "EXPENSE",
        amount: roundMoney(120000 + r() * 480000),
        date: d(year, month, 4 + Math.floor(r() * 18), 13),
        note: `Pembelian stok aksesoris / kabel — ${label}`,
        accountId: kas.id,
        categoryId: cat["Pembelian Stok"].id,
      });
    }

    // Transport
    const tripCount = 1 + Math.floor(r() * 3);
    for (let i = 0; i < tripCount; i++) {
      allTx.push({
        type: "EXPENSE",
        amount: roundMoney(45000 + r() * 180000),
        date: d(year, month, 3 + Math.floor(r() * 22), 17),
        note: `Transport meeting klien — ${label}`,
        accountId: r() > 0.4 ? ewallet.id : kas.id,
        categoryId: cat["Transportasi"].id,
      });
    }

    // Pajak triwulanan (Mar, Jun, Sep, Des) + cicilan kecil tiap bulan
    if ([3, 6, 9, 12].includes(month)) {
      allTx.push({
        type: "EXPENSE",
        amount: roundMoney(800000 + r() * 700000),
        date: d(year, month, 20, 11),
        note: `Estimasi PPh triwulanan — ${label}`,
        accountId: bank.id,
        categoryId: cat["Pajak"].id,
      });
    } else if (r() > 0.5) {
      allTx.push({
        type: "EXPENSE",
        amount: roundMoney(150000 + r() * 200000),
        date: d(year, month, 18, 11),
        note: `Cicilan pajak / admin — ${label}`,
        accountId: bank.id,
        categoryId: cat["Pajak"].id,
      });
    }

    // Transfer bank → kas tiap bulan
    allTx.push({
      type: "TRANSFER",
      amount: roundMoney(500000 + r() * 1000000),
      date: d(year, month, 7, 8),
      note: `Tarik tunai operasional — ${label}`,
      transferFromId: bank.id,
      transferToId: kas.id,
    });

    // Kadang top-up ewallet
    if (r() > 0.55) {
      allTx.push({
        type: "TRANSFER",
        amount: roundMoney(200000 + r() * 500000),
        date: d(year, month, 15, 12),
        note: `Top-up GoPay bisnis — ${label}`,
        transferFromId: bank.id,
        transferToId: ewallet.id,
      });
    }
  }

  // Insert in batches
  const BATCH = 50;
  for (let i = 0; i < allTx.length; i += BATCH) {
    const chunk = allTx.slice(i, i + BATCH);
    await prisma.$transaction(
      chunk.map((tx) =>
        prisma.transaction.create({
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
        })
      )
    );
  }

  console.log("Menambahkan anggaran 12 bulan...");
  const budgetCats = [
    { categoryId: cat["Operasional"].id, amount: 1500000 },
    { categoryId: cat["Pemasaran"].id, amount: 1000000 },
    { categoryId: cat["Gaji Karyawan"].id, amount: 6000000 },
    { categoryId: cat["Sewa & Utilitas"].id, amount: 2500000 },
    { categoryId: cat["Transportasi"].id, amount: 500000 },
    { categoryId: cat["Pembelian Stok"].id, amount: 1000000 },
  ];

  for (const { year, month } of months) {
    for (const b of budgetCats) {
      // Anggaran naik sedikit tiap kuartal
      const bump = 1 + Math.floor((month - 1) / 3) * 0.05;
      await prisma.budget.create({
        data: {
          categoryId: b.categoryId,
          amount: roundMoney(b.amount * bump),
          month,
          year,
          businessId: business.id,
        },
      });
    }
  }

  console.log("Menambahkan hutang & piutang...");
  const last = months[months.length - 1];
  await prisma.debt.createMany({
    data: [
      {
        type: "RECEIVABLE",
        partyName: "PT Sinar Digital",
        amount: 3500000,
        paidAmount: 1000000,
        status: "PARTIAL",
        dueDate: d(last.year, last.month, 25),
        note: "Sisa invoice project website",
        businessId: business.id,
      },
      {
        type: "RECEIVABLE",
        partyName: "CV Maju Jaya",
        amount: 1500000,
        paidAmount: 0,
        status: "UNPAID",
        dueDate: d(last.year, last.month, 20),
        note: "Tagihan maintenance berjalan",
        businessId: business.id,
      },
      {
        type: "RECEIVABLE",
        partyName: "Toko Online Berkah",
        amount: 2200000,
        paidAmount: 2200000,
        status: "PAID",
        dueDate: d(months[8].year, months[8].month, 15),
        note: "Invoice landing page (lunas)",
        businessId: business.id,
      },
      {
        type: "PAYABLE",
        partyName: "Vendor Hosting CloudID",
        amount: 900000,
        paidAmount: 0,
        status: "UNPAID",
        dueDate: d(last.year, last.month, 18),
        note: "Biaya server tahunan cicilan",
        businessId: business.id,
      },
      {
        type: "PAYABLE",
        partyName: "Kredit Motor Dealer XYZ",
        amount: 13000000,
        paidAmount: 4000000,
        status: "PARTIAL",
        dueDate: d(last.year, last.month, 10),
        startDate: d(months[0].year, months[0].month, 10),
        installmentCount: 13,
        installmentPaid: 4,
        note: "Cicilan 13x — contoh multi-periode",
        businessId: business.id,
      },
    ],
  });

  console.log("Menambahkan tabungan target + kontribusi sepanjang tahun...");
  const travelGoal = await prisma.savingsGoal.create({
    data: {
      name: "Liburan Bali",
      targetAmount: 8000000,
      currentAmount: 0,
      deadline: d(2026, 9, 30),
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
      currentAmount: 0,
      deadline: d(2026, 12, 15),
      category: "PURCHASE",
      color: "#0F766E",
      note: "Upgrade MacBook untuk development",
      businessId: business.id,
      status: "ACTIVE",
    },
  });
  const emergencyGoal = await prisma.savingsGoal.create({
    data: {
      name: "Dana Darurat Usaha",
      targetAmount: 12000000,
      currentAmount: 0,
      deadline: d(2026, 12, 31),
      category: "EMERGENCY",
      color: "#B45309",
      note: "Cadangan 3 bulan operasional",
      businessId: business.id,
      status: "ACTIVE",
    },
  });

  let travelTotal = 0;
  let laptopTotal = 0;
  let emergencyTotal = 0;
  const contributions: Array<{
    goalId: string;
    amount: number;
    date: Date;
    note: string;
    accountId: string;
    businessId: string;
  }> = [];

  for (let mi = 0; mi < months.length; mi++) {
    const { year, month } = months[mi];
    const travelAmt = roundMoney(400000 + rand() * 350000);
    const laptopAmt = roundMoney(600000 + rand() * 500000);
    const emergencyAmt = roundMoney(300000 + rand() * 400000);
    travelTotal += travelAmt;
    laptopTotal += laptopAmt;
    emergencyTotal += emergencyAmt;
    contributions.push(
      {
        goalId: travelGoal.id,
        amount: travelAmt,
        date: d(year, month, 3),
        note: `Setoran rutin ${MONTH_NAMES[month - 1]}`,
        accountId: bank.id,
        businessId: business.id,
      },
      {
        goalId: laptopGoal.id,
        amount: laptopAmt,
        date: d(year, month, 12),
        note: `Setoran laptop ${MONTH_NAMES[month - 1]}`,
        accountId: bank.id,
        businessId: business.id,
      },
      {
        goalId: emergencyGoal.id,
        amount: emergencyAmt,
        date: d(year, month, 20),
        note: `Dana darurat ${MONTH_NAMES[month - 1]}`,
        accountId: ewallet.id,
        businessId: business.id,
      }
    );
  }

  await prisma.savingsContribution.createMany({ data: contributions });
  await prisma.savingsGoal.update({
    where: { id: travelGoal.id },
    data: { currentAmount: Math.min(travelTotal, 8000000) },
  });
  await prisma.savingsGoal.update({
    where: { id: laptopGoal.id },
    data: { currentAmount: Math.min(laptopTotal, 18000000) },
  });
  await prisma.savingsGoal.update({
    where: { id: emergencyGoal.id },
    data: { currentAmount: Math.min(emergencyTotal, 12000000) },
  });

  await prisma.activityLog.create({
    data: {
      action: "SEED",
      detail: "Database di-seed akun Iman / Manzcode + dummy 12 bulan (Agustus 2025–Juli 2026)",
      userId: user.id,
      businessId: business.id,
    },
  });

  const income = allTx.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const expense = allTx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);

  console.log("\nSeeder selesai!");
  console.log("────────────────────────────");
  console.log("Nama     : Iman");
  console.log("Bisnis   : Manzcode");
  console.log("Email    :", email);
  console.log("Password :", password);
  console.log("────────────────────────────");
  console.log(`Periode             : ${months[0].year}-${String(months[0].month).padStart(2, "0")} s/d ${months[11].year}-${String(months[11].month).padStart(2, "0")}`);
  console.log(`Transaksi           : ${allTx.length} record`);
  console.log(`Anggaran            : ${months.length * budgetCats.length} baris`);
  console.log(`Kontribusi tabungan : ${contributions.length} setoran`);
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
