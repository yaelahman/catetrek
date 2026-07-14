import { Router } from "express";
import PDFDocument from "pdfkit";
import { prisma } from "../utils/prisma";
import { ok, fail } from "../utils/response";
import { requireAuth, requireBusiness } from "../middleware/auth";
import { startOfMonth, endOfMonth, startOfYear, endOfYear, format } from "date-fns";

const router = Router();
router.use(requireAuth, requireBusiness);

function idr(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

router.get("/summary", async (req, res) => {
  const businessId = req.businessId!;
  const period = (req.query.period as string) || "month";
  const now = new Date();
  const year = parseInt((req.query.year as string) || String(now.getFullYear()), 10);
  const month = parseInt((req.query.month as string) || String(now.getMonth() + 1), 10);

  const start = period === "year" ? startOfYear(new Date(year, 0, 1)) : startOfMonth(new Date(year, month - 1, 1));
  const end = period === "year" ? endOfYear(new Date(year, 0, 1)) : endOfMonth(new Date(year, month - 1, 1));

  const [income, expense, byCategory, byAccount] = await Promise.all([
    prisma.transaction.aggregate({
      where: { businessId, type: "INCOME", date: { gte: start, lte: end }, deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { businessId, type: "EXPENSE", date: { gte: start, lte: end }, deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        businessId,
        deletedAt: null,
        type: { in: ["INCOME", "EXPENSE"] },
        date: { gte: start, lte: end },
        categoryId: { not: null },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["accountId"],
      where: {
        businessId,
        deletedAt: null,
        type: { in: ["INCOME", "EXPENSE"] },
        date: { gte: start, lte: end },
        accountId: { not: null },
      },
      _sum: { amount: true },
    }),
  ]);

  const categoryIds = byCategory.map((c) => c.categoryId!).filter(Boolean);
  const accountIds = byAccount.map((a) => a.accountId!).filter(Boolean);

  const [categories, accounts] = await Promise.all([
    prisma.category.findMany({ where: { id: { in: categoryIds } } }),
    prisma.account.findMany({ where: { id: { in: accountIds } } }),
  ]);

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const accMap = Object.fromEntries(accounts.map((a) => [a.id, a]));

  return ok(res, {
    period,
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
    income: Number(income._sum.amount || 0),
    expense: Number(expense._sum.amount || 0),
    net: Number(income._sum.amount || 0) - Number(expense._sum.amount || 0),
    byCategory: byCategory.map((c) => ({
      categoryId: c.categoryId,
      category: catMap[c.categoryId!],
      amount: Number(c._sum.amount || 0),
    })),
    byAccount: byAccount.map((a) => ({
      accountId: a.accountId,
      account: accMap[a.accountId!],
      amount: Number(a._sum.amount || 0),
    })),
  });
});

router.get("/export.csv", async (req, res) => {
  try {
    const businessId = req.businessId!;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const items = await prisma.transaction.findMany({
      where: {
        businessId,
        deletedAt: null,
        ...(startDate || endDate
          ? {
              date: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      include: {
        account: true,
        category: true,
        transferFrom: true,
        transferTo: true,
      },
      orderBy: { date: "asc" },
    });

    const header = ["Tanggal", "Tipe", "Jumlah", "Akun", "Kategori", "Catatan"];
    const rows = items.map((t) => {
      const account =
        t.type === "TRANSFER"
          ? `${t.transferFrom?.name || "-"} → ${t.transferTo?.name || "-"}`
          : t.account?.name || "-";
      return [
        format(t.date, "yyyy-MM-dd"),
        t.type,
        String(t.amount),
        `"${account.replace(/"/g, '""')}"`,
        `"${(t.category?.name || "-").replace(/"/g, '""')}"`,
        `"${(t.note || "").replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csv = [header.join(","), ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="catetrek-transaksi.csv"');
    return res.send("\uFEFF" + csv);
  } catch {
    return fail(res, "Gagal export CSV", 500);
  }
});

router.get("/export.pdf", async (req, res) => {
  try {
    const businessId = req.businessId!;
    const period = (req.query.period as string) || "month";
    const now = new Date();
    const year = parseInt((req.query.year as string) || String(now.getFullYear()), 10);
    const month = parseInt((req.query.month as string) || String(now.getMonth() + 1), 10);

    const start =
      period === "year" ? startOfYear(new Date(year, 0, 1)) : startOfMonth(new Date(year, month - 1, 1));
    const end =
      period === "year" ? endOfYear(new Date(year, 0, 1)) : endOfMonth(new Date(year, month - 1, 1));

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) return fail(res, "Bisnis tidak ditemukan", 404);

    const [incomeAgg, expenseAgg, items] = await Promise.all([
      prisma.transaction.aggregate({
        where: { businessId, type: "INCOME", date: { gte: start, lte: end }, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { businessId, type: "EXPENSE", date: { gte: start, lte: end }, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.transaction.findMany({
        where: {
          businessId,
          deletedAt: null,
          date: { gte: start, lte: end },
          type: { in: ["INCOME", "EXPENSE", "TRANSFER"] },
        },
        include: {
          account: true,
          category: true,
          transferFrom: true,
          transferTo: true,
        },
        orderBy: { date: "asc" },
      }),
    ]);

    const income = incomeAgg._sum.amount || 0;
    const expense = expenseAgg._sum.amount || 0;
    const net = income - expense;

    const doc = new PDFDocument({ margin: 48, size: "A4" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="catetrek-laporan-${format(start, "yyyy-MM")}.pdf"`
    );
    doc.pipe(res);

    doc.fillColor("#0B5F56").fontSize(22).text("Catetrek", { continued: false });
    doc.fillColor("#14221e").fontSize(14).text(`Laporan Keuangan — ${business.name}`);
    doc
      .fontSize(10)
      .fillColor("#5b6b66")
      .text(`Periode: ${format(start, "dd MMM yyyy")} s/d ${format(end, "dd MMM yyyy")}`);
    doc.text(`Dicetak: ${format(new Date(), "dd MMM yyyy HH:mm")}`);
    doc.moveDown();

    doc.fillColor("#0B5F56").fontSize(12).text("Ringkasan");
    doc.moveDown(0.4);
    doc.fillColor("#14221e").fontSize(10);
    doc.text(`Pemasukan   : ${idr(income)}`);
    doc.text(`Pengeluaran : ${idr(expense)}`);
    doc.text(`Net         : ${idr(net)}`);
    doc.moveDown();

    doc.fillColor("#0B5F56").fontSize(12).text("Detail Transaksi");
    doc.moveDown(0.5);

    const colX = [48, 110, 175, 300, 420];
    doc.fontSize(9).fillColor("#5b6b66");
    doc.text("Tanggal", colX[0], doc.y, { continued: false });
    const headerY = doc.y - 11;
    doc.text("Tipe", colX[1], headerY);
    doc.text("Kategori / Akun", colX[2], headerY);
    doc.text("Catatan", colX[3], headerY);
    doc.text("Jumlah", colX[4], headerY, { width: 120, align: "right" });
    doc
      .moveTo(48, doc.y + 4)
      .lineTo(547, doc.y + 4)
      .strokeColor("#d7e3dd")
      .stroke();
    doc.moveDown(0.6);

    doc.fillColor("#14221e");
    for (const t of items) {
      if (doc.y > 740) {
        doc.addPage();
        doc.fillColor("#14221e").fontSize(9);
      }

      const y = doc.y;
      const categoryOrAccount =
        t.type === "TRANSFER"
          ? `${t.transferFrom?.name || "-"} -> ${t.transferTo?.name || "-"}`
          : `${t.category?.name || "-"} / ${t.account?.name || "-"}`;

      doc.text(format(t.date, "dd/MM/yy"), colX[0], y, { width: 55 });
      doc.text(t.type, colX[1], y, { width: 60 });
      doc.text(categoryOrAccount, colX[2], y, { width: 115 });
      doc.text(t.note || "-", colX[3], y, { width: 110 });
      doc.text(idr(t.amount), colX[4], y, { width: 120, align: "right" });
      doc.moveDown(0.85);
    }

    doc.moveDown();
    doc
      .fontSize(8)
      .fillColor("#5b6b66")
      .text("Dokumen ini dihasilkan otomatis oleh Catetrek.", 48, 780, {
        align: "center",
        width: 500,
      });

    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) return fail(res, "Gagal export PDF", 500);
  }
});

export default router;
