"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  Filter,
  Hash,
  NotebookPen,
  Package,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { Protected } from "@/components/Protected";
import {
  Badge,
  Button,
  EmptyState,
  FileAttach,
  Input,
  Modal,
  MoneyInput,
  PageHeader,
  PaginationBar,
  Select,
  TableShell,
  TextArea,
} from "@/components/ui";
import { API_URL, api } from "@/lib/api";
import { confirm, toast } from "@/lib/alert";
import { formatDate, formatIDR } from "@/lib/format";
import { useRealtimeRefresh, useSocket } from "@/lib/socket";
import { usePathname } from "next/navigation";

type Account = { id: string; name: string; isActive: boolean };
type Category = { id: string; name: string; type: string; isActive: boolean; children?: Category[] };
type Product = {
  id: string;
  name: string;
  sku?: string | null;
  price: number;
  stock?: number | null;
  unit: string;
  isActive: boolean;
};
type Tx = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  date: string;
  note?: string | null;
  attachmentUrl?: string | null;
  quantity?: number | null;
  account?: Account | null;
  category?: Category | null;
  product?: Product | null;
  accountId?: string | null;
  categoryId?: string | null;
  productId?: string | null;
  transferFrom?: Account | null;
  transferTo?: Account | null;
  transferFromId?: string | null;
  transferToId?: string | null;
};

type Pagination = { page: number; limit: number; total: number; totalPages: number };

const emptyForm = {
  type: "EXPENSE",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  note: "",
  accountId: "",
  categoryId: "",
  productId: "",
  quantity: "1",
  transferFromId: "",
  transferToId: "",
};

export default function TransactionsPage() {
  const pathname = usePathname();
  const { bump } = useSocket();
  const [items, setItems] = useState<Tx[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saleForm, setSaleForm] = useState({
    accountId: "",
    date: new Date().toISOString().slice(0, 10),
    note: "",
  });
  /** Keranjang: productId -> qty */
  const [saleCart, setSaleCart] = useState<Record<string, number>>({});
  const [saleProductQ, setSaleProductQ] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, typeFilter, accountFilter, categoryFilter, startDate, endDate]);

  const loadMeta = useCallback(async () => {
    const [acc, cats, prods] = await Promise.all([
      api<Account[]>("/api/accounts"),
      api<Category[]>("/api/categories"),
      api<Product[]>("/api/products"),
    ]);
    setAccounts(acc.filter((a) => a.isActive !== false));
    const flat = cats.flatMap((c) => [c, ...(c.children || [])]);
    setCategories(flat.filter((c) => c.isActive !== false));
    setProducts(prods.filter((p) => p.isActive !== false));
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
    if (typeFilter) params.set("type", typeFilter);
    if (accountFilter) params.set("accountId", accountFilter);
    if (categoryFilter) params.set("categoryId", categoryFilter);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const data = await api<{ items: Tx[]; pagination: Pagination }>(`/api/transactions?${params}`);
    setItems(data.items);
    setPagination(data.pagination);
  }, [debouncedQ, typeFilter, accountFilter, categoryFilter, startDate, endDate, page]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useRealtimeRefresh(load);

  // Saat buka menu Transaksi, paksa halaman 1 + refetch (data terbaru setelah bayar hutang, dll.)
  useEffect(() => {
    if (!pathname.startsWith("/transactions")) return;
    setPage(1);
    bump();
  }, [pathname, bump]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [bump]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setAttachment(null);
    setError("");
    setOpen(true);
  }

  function openSale() {
    setSaleForm({
      accountId: accounts[0]?.id || "",
      date: new Date().toISOString().slice(0, 10),
      note: "",
    });
    setSaleCart({});
    setSaleProductQ("");
    setError("");
    setSaleOpen(true);
  }

  function closeSaleModal() {
    setSaleOpen(false);
    setSaleCart({});
    setError("");
  }

  function openEdit(t: Tx) {
    setEditingId(t.id);
    setForm({
      type: t.type,
      amount: String(t.amount),
      date: t.date.slice(0, 10),
      note: t.note || "",
      accountId: t.accountId || t.account?.id || "",
      categoryId: t.categoryId || t.category?.id || "",
      productId: t.productId || t.product?.id || "",
      quantity: t.quantity != null ? String(t.quantity) : "1",
      transferFromId: t.transferFromId || t.transferFrom?.id || "",
      transferToId: t.transferToId || t.transferTo?.id || "",
    });
    setAttachment(null);
    setError("");
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditingId(null);
    setAttachment(null);
    setError("");
  }

  function toggleSaleProduct(productId: string) {
    setSaleCart((prev) => {
      if (prev[productId]) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: 1 };
    });
  }

  function setSaleQty(productId: string, raw: string) {
    const qty = Math.max(1, Math.floor(Number(raw) || 1));
    setSaleCart((prev) => {
      if (!prev[productId]) return prev;
      return { ...prev, [productId]: qty };
    });
  }

  function incomeCategoryId() {
    return (
      categories.find((c) => c.type === "INCOME" && /penjualan produk/i.test(c.name))?.id ||
      categories.find((c) => c.type === "INCOME" && /penjualan/i.test(c.name))?.id ||
      categories.find((c) => c.type === "INCOME")?.id ||
      ""
    );
  }

  const saleCartItems = Object.entries(saleCart)
    .map(([productId, quantity]) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return null;
      return {
        product,
        quantity,
        subtotal: Math.round(product.price * quantity * 100) / 100,
      };
    })
    .filter(Boolean) as Array<{ product: Product; quantity: number; subtotal: number }>;

  const saleTotal = saleCartItems.reduce((s, i) => s + i.subtotal, 0);

  const filteredSaleProducts = products.filter((p) => {
    const q = saleProductQ.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q);
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === "productId" || k === "quantity") {
          if (form.type === "INCOME" && form.productId) fd.append(k, v || (k === "quantity" ? "1" : ""));
          return;
        }
        if (v) fd.append(k, v);
      });
      if (attachment) fd.append("attachment", attachment);

      if (editingId) {
        await api(`/api/transactions/${editingId}`, { method: "PATCH", formData: fd });
      } else {
        await api("/api/transactions", { method: "POST", formData: fd });
      }
      closeModal();
      setForm(emptyForm);
      bump();
      await load();
      await loadMeta();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal simpan");
    } finally {
      setBusy(false);
    }
  }

  async function onSaleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saleCartItems.length === 0) {
      setError("Pilih minimal 1 produk");
      return;
    }
    if (!saleForm.accountId) {
      setError("Pilih akun penerima");
      return;
    }

    for (const item of saleCartItems) {
      if (item.product.stock != null && item.product.stock < item.quantity) {
        setError(
          `Stok "${item.product.name}" tidak cukup. Tersedia: ${item.product.stock} ${item.product.unit}`
        );
        return;
      }
    }

    setBusy(true);
    setError("");
    try {
      const categoryId = incomeCategoryId();
      const result = await api<{ count: number; total: number }>("/api/transactions/sale", {
        method: "POST",
        body: JSON.stringify({
          accountId: saleForm.accountId,
          date: saleForm.date,
          note: saleForm.note.trim() || undefined,
          categoryId: categoryId || undefined,
          items: saleCartItems.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
          })),
        }),
      });
      toast({
        title: "Penjualan tersimpan",
        message: `${result.count} produk · ${formatIDR(result.total)}`,
        tone: "success",
      });
      closeSaleModal();
      bump();
      await load();
      await loadMeta();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal simpan penjualan");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (
      !(await confirm({
        title: "Arsipkan transaksi?",
        message: "Transaksi tidak akan muncul di laporan aktif, tetapi tetap tersimpan di arsip.",
        confirmText: "Ya, arsipkan",
        tone: "danger",
      }))
    )
      return;
    await api(`/api/transactions/${id}`, { method: "DELETE" });
    toast({ title: "Diarsipkan", message: "Transaksi berhasil diarsipkan.", tone: "success" });
    bump();
    await load();
    await loadMeta();
  }

  const filteredCategories = categories.filter((c) =>
    form.type === "TRANSFER" ? false : c.type === form.type
  );

  return (
    <Protected>
      <PageHeader
        title="Transaksi"
        subtitle="Catat pemasukan, pengeluaran, dan transfer — sinkron ke semua perangkat."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={openSale}>
              <Package size={16} /> Penjualan Produk
            </Button>
            <Button onClick={openCreate}>
              <Plus size={16} /> Tambah
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Input
          label="Cari catatan transaksi"
          icon={<Search size={16} />}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select
          label="Filter tipe"
          variant="filter"
          icon={<Filter size={16} />}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">Semua tipe</option>
          <option value="INCOME">Pemasukan</option>
          <option value="EXPENSE">Pengeluaran</option>
          <option value="TRANSFER">Transfer</option>
        </Select>
        <Select
          label="Filter akun"
          variant="filter"
          icon={<Wallet size={16} />}
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
        >
          <option value="">Semua akun</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select
          label="Filter kategori"
          variant="filter"
          icon={<Filter size={16} />}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">Semua kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input
          label="Dari tanggal"
          type="date"
          icon={<CalendarDays size={16} />}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          label="Sampai tanggal"
          type="date"
          icon={<CalendarDays size={16} />}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Belum ada transaksi"
          desc="Tambah transaksi pertama untuk mulai melihat arus kas usaha."
        />
      ) : (
        <>
          <TableShell minWidth="52rem">
            <table className="w-full text-left text-sm">
              <thead style={{ background: "var(--table-head)" }} className="text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3.5 font-semibold">Tanggal</th>
                  <th className="px-4 py-3.5 font-semibold">Detail</th>
                  <th className="px-4 py-3.5 font-semibold">Kategori</th>
                  <th className="px-4 py-3.5 font-semibold">Akun</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Jumlah</th>
                  <th className="px-4 py-3.5 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((t, i) => (
                  <tr
                    key={t.id}
                    className="border-t border-[var(--line)]/70 transition hover:bg-[var(--brand-soft)]/30"
                    style={{ animationDelay: `${i * 0.02}s` }}
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          tone={
                            t.type === "INCOME" ? "success" : t.type === "EXPENSE" ? "danger" : "brand"
                          }
                        >
                          {t.type}
                        </Badge>
                        {t.product && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--brand)]">
                            <Package size={12} />
                            {t.product.name}
                            {t.quantity != null && Number(t.quantity) > 1
                              ? ` × ${t.quantity}`
                              : ""}
                          </span>
                        )}
                        {t.attachmentUrl && (
                          <a
                            href={`${API_URL}${t.attachmentUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--brand)] hover:opacity-80"
                          >
                            <Paperclip size={12} /> Bukti
                          </a>
                        )}
                      </div>
                      {t.note && <p className="mt-1 text-xs text-[var(--muted)]">{t.note}</p>}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-medium">{t.category?.name || (t.type === "TRANSFER" ? "Transfer" : "—")}</span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {t.type === "TRANSFER"
                        ? `${t.transferFrom?.name} → ${t.transferTo?.name}`
                        : t.account?.name}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold whitespace-nowrap">
                      {formatIDR(t.amount)}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <Button variant="ghost" onClick={() => openEdit(t)}>
                        <Pencil size={14} /> Edit
                      </Button>
                      <Button variant="ghost" onClick={() => remove(t.id)}>
                        <Trash2 size={14} /> Hapus
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>

          <PaginationBar
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            onPageChange={setPage}
          />
        </>
      )}

      <Modal open={open} onClose={closeModal} title={editingId ? "Edit transaksi" : "Tambah transaksi"}>
        <form onSubmit={onSubmit} className="stagger space-y-3.5">
          <Select
            label="Tipe transaksi"
            icon={<Filter size={16} />}
            value={form.type}
            onChange={(e) => {
              const type = e.target.value;
              setForm({
                ...form,
                type,
                productId: "",
                quantity: "1",
                categoryId: "",
              });
            }}
          >
            <option value="INCOME">Pemasukan</option>
            <option value="EXPENSE">Pengeluaran</option>
            <option value="TRANSFER">Transfer</option>
          </Select>

          <MoneyInput
            label="Jumlah uang"
            required
            icon={<Hash size={16} />}
            value={form.amount}
            onValueChange={(raw) => setForm({ ...form, amount: raw })}
          />
          <Input
            label="Tanggal"
            type="date"
            required
            icon={<CalendarDays size={16} />}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />

          {form.type === "TRANSFER" ? (
            <>
              <Select
                label="Dari akun"
                required
                icon={<Wallet size={16} />}
                value={form.transferFromId}
                onChange={(e) => setForm({ ...form, transferFromId: e.target.value })}
              >
                <option value="">Pilih akun asal</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Ke akun"
                required
                icon={<Wallet size={16} />}
                value={form.transferToId}
                onChange={(e) => setForm({ ...form, transferToId: e.target.value })}
              >
                <option value="">Pilih akun tujuan</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </>
          ) : (
            <>
              <Select
                label="Akun"
                required
                icon={<Wallet size={16} />}
                value={form.accountId}
                onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              >
                <option value="">Pilih akun</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Kategori"
                required
                icon={<Filter size={16} />}
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Pilih kategori</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </>
          )}

          <TextArea
            label="Catatan (opsional)"
            rows={2}
            icon={<NotebookPen size={16} />}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />

          <FileAttach file={attachment} onChange={setAttachment} />

          {error && !saleOpen && (
            <p className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-[var(--danger)] dark:border-orange-500/30 dark:bg-orange-500/10">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="w-full py-3">
            {busy ? "Menyimpan..." : editingId ? "Simpan perubahan" : "Simpan transaksi"}
          </Button>
        </form>
      </Modal>

      <Modal open={saleOpen} onClose={closeSaleModal} title="Penjualan Produk">
        <form onSubmit={onSaleSubmit} className="space-y-4">
          <Input
            label="Cari produk"
            icon={<Search size={16} />}
            value={saleProductQ}
            onChange={(e) => setSaleProductQ(e.target.value)}
          />

          <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {filteredSaleProducts.length === 0 ? (
              <p className="rounded-xl border border-[var(--line)] px-3 py-4 text-center text-sm text-[var(--muted)]">
                {products.length === 0
                  ? "Belum ada produk. Tambah dulu di menu Produk."
                  : "Tidak ada produk yang cocok."}
              </p>
            ) : (
              filteredSaleProducts.map((p) => {
                const active = Boolean(saleCart[p.id]);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleSaleProduct(p.id)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                        : "border-[var(--line)] hover:bg-[var(--brand-soft)]/40"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border text-[10px] font-bold ${
                        active
                          ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                          : "border-[var(--line)] text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
                      <Package size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{p.name}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        SKU: {p.sku || "—"}
                        {p.stock != null ? ` · Stok ${p.stock} ${p.unit}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-[var(--success)]">{formatIDR(p.price)}</p>
                      <p className="text-[10px] text-[var(--muted)]">/{p.unit}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {saleCartItems.length > 0 && (
            <div className="space-y-2 rounded-xl border border-[var(--line)] bg-[var(--brand-soft)]/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Keranjang ({saleCartItems.length})
              </p>
              {saleCartItems.map(({ product, quantity, subtotal }) => (
                <div
                  key={product.id}
                  className="flex flex-wrap items-center gap-2 border-b border-[var(--line)]/60 py-2 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{product.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {formatIDR(product.price)} / {product.unit}
                    </p>
                  </div>
                  <Input
                    label="Qty"
                    type="number"
                    min={1}
                    step="1"
                    className="w-20"
                    value={String(quantity)}
                    onChange={(e) => setSaleQty(product.id, e.target.value)}
                  />
                  <div className="w-24 text-right">
                    <p className="text-xs text-[var(--muted)]">Subtotal</p>
                    <p className="text-sm font-semibold">{formatIDR(subtotal)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => toggleSaleProduct(product.id)}
                    aria-label={`Hapus ${product.name}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <p className="text-sm font-semibold">Total</p>
                <p className="text-lg font-bold text-[var(--success)]">{formatIDR(saleTotal)}</p>
              </div>
            </div>
          )}

          <Select
            label="Akun penerima"
            required
            icon={<Wallet size={16} />}
            value={saleForm.accountId}
            onChange={(e) => setSaleForm({ ...saleForm, accountId: e.target.value })}
          >
            <option value="">Pilih akun</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>

          <Input
            label="Tanggal"
            type="date"
            required
            icon={<CalendarDays size={16} />}
            value={saleForm.date}
            onChange={(e) => setSaleForm({ ...saleForm, date: e.target.value })}
          />

          <TextArea
            label="Catatan (opsional)"
            rows={2}
            icon={<NotebookPen size={16} />}
            value={saleForm.note}
            onChange={(e) => setSaleForm({ ...saleForm, note: e.target.value })}
          />

          {error && saleOpen && (
            <p className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-[var(--danger)] dark:border-orange-500/30 dark:bg-orange-500/10">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={busy || saleCartItems.length === 0}
            className="w-full py-3"
          >
            {busy
              ? "Menyimpan..."
              : `Simpan penjualan${saleCartItems.length ? ` (${saleCartItems.length} produk)` : ""}`}
          </Button>
        </form>
      </Modal>
    </Protected>
  );
}
