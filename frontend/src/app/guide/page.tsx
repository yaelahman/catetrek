import Link from "next/link";
import {
  ArrowLeftRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  FileBarChart2,
  Handshake,
  Package,
  PieChart,
  PiggyBank,
  Settings,
  Sparkles,
  Tags,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Protected } from "@/components/Protected";
import { Card, PageHeader } from "@/components/ui";

const steps = [
  {
    id: "akun",
    title: "Buat akun dan bisnis",
    icon: UserPlus,
    href: "/register",
    action: "Buka pendaftaran",
    points: [
      "Daftar menggunakan nama, email, password, dan nama bisnis.",
      "Setelah masuk, pilih bisnis aktif jika Anda memiliki lebih dari satu bisnis.",
      "Simpan password dengan aman dan gunakan menu Pengaturan bila ingin menggantinya.",
    ],
  },
  {
    id: "akun-dompet",
    title: "Siapkan akun dompet",
    icon: Wallet,
    href: "/accounts",
    action: "Kelola akun dompet",
    points: [
      "Tambahkan sumber dana seperti Kas Tunai, rekening bank, dan e-wallet.",
      "Isi saldo awal sesuai saldo yang tersedia ketika mulai memakai Catetrek.",
      "Setiap transaksi harus masuk ke salah satu akun agar saldo dapat dihitung dengan benar.",
    ],
  },
  {
    id: "kategori",
    title: "Atur kategori",
    icon: Tags,
    href: "/categories",
    action: "Kelola kategori",
    points: [
      "Pisahkan kategori pemasukan dan pengeluaran.",
      "Gunakan kategori Penjualan Produk untuk transaksi produk.",
      "Contoh pengeluaran: Operasional, Gaji, Pemasaran, Transportasi, dan Pajak.",
    ],
  },
  {
    id: "produk",
    title: "Tambahkan produk atau jasa",
    icon: Package,
    href: "/products",
    action: "Kelola produk",
    points: [
      "Isi nama produk, SKU, harga jual, dan satuan.",
      "Aktifkan pelacakan stok untuk barang fisik; matikan untuk jasa atau produk digital.",
      "Produk aktif akan tersedia pada modal Penjualan Produk di halaman Transaksi.",
    ],
  },
  {
    id: "penjualan",
    title: "Catat penjualan produk",
    icon: Package,
    href: "/transactions",
    action: "Buka transaksi",
    points: [
      "Klik Penjualan Produk di sebelah tombol Tambah.",
      "Centang satu atau lebih produk, lalu atur qty masing-masing di keranjang.",
      "Pilih akun penerima dan tanggal, lalu klik Simpan penjualan.",
      "Setiap produk menjadi 1 transaksi pemasukan; total dan stok dihitung otomatis.",
    ],
  },
  {
    id: "transaksi",
    title: "Catat transaksi lainnya",
    icon: ArrowLeftRight,
    href: "/transactions",
    action: "Tambah transaksi",
    points: [
      "Gunakan Tambah untuk pemasukan manual, pengeluaran, atau transfer antar akun.",
      "Pilih tipe, jumlah, tanggal, akun, kategori, dan catatan.",
      "Lampirkan foto atau PDF bukti transaksi bila diperlukan.",
      "Transfer memindahkan saldo antar akun dan tidak dihitung sebagai pemasukan/pengeluaran.",
    ],
  },
  {
    id: "anggaran",
    title: "Buat anggaran bulanan",
    icon: PieChart,
    href: "/budgets",
    action: "Atur anggaran",
    points: [
      "Tentukan batas pengeluaran per kategori untuk bulan berjalan.",
      "Bandingkan realisasi dengan anggaran agar pengeluaran lebih terkendali.",
      "Salin anggaran bulan sebelumnya untuk mempercepat setup rutin.",
    ],
  },
  {
    id: "hutang",
    title: "Pantau hutang dan piutang",
    icon: Handshake,
    href: "/debts",
    action: "Kelola hutang",
    points: [
      "Pilih Hutang untuk kewajiban yang harus dibayar dan Piutang untuk uang yang harus diterima.",
      "Isi nominal, jatuh tempo, dan jumlah cicilan jika ada.",
      "Saat mencatat pembayaran, hubungkan ke akun agar otomatis menjadi transaksi kas.",
    ],
  },
  {
    id: "tabungan",
    title: "Buat target tabungan",
    icon: PiggyBank,
    href: "/savings",
    action: "Kelola tabungan",
    points: [
      "Tentukan nama tujuan, target nominal, dan tenggat waktu.",
      "Catat setoran atau penarikan secara berkala.",
      "Hubungkan ke akun supaya setoran dan penarikan tercermin pada arus kas.",
    ],
  },
  {
    id: "laporan",
    title: "Periksa laporan",
    icon: FileBarChart2,
    href: "/reports",
    action: "Lihat laporan",
    points: [
      "Lihat pemasukan, pengeluaran, net, ringkasan kategori, dan akun.",
      "Gunakan menu Perbandingan untuk melihat perubahan 12 bulan dan persentase naik/turun.",
      "Ekspor laporan ke CSV atau PDF untuk arsip dan evaluasi usaha.",
    ],
  },
  {
    id: "pengaturan",
    title: "Sesuaikan pengaturan",
    icon: Settings,
    href: "/settings",
    action: "Buka pengaturan",
    points: [
      "Ubah profil, password, tema warna, dan mode tampilan.",
      "Install Catetrek sebagai aplikasi di ponsel melalui opsi PWA.",
      "Periksa bisnis aktif sebelum mencatat data agar tidak masuk ke bisnis yang salah.",
    ],
  },
];

const quickStepIndexes = [1, 2, 3, 4, 5, 9];

export default function GuidePage() {
  return (
    <Protected>
      <PageHeader
        title="Panduan Catetrek"
        subtitle="Langkah penggunaan dari setup awal sampai mencatat penjualan dan membaca laporan."
      />

      <div className="relative mb-6 overflow-hidden rounded-[1.5rem] border border-[var(--brand)]/20 bg-gradient-to-br from-[var(--brand-soft)] via-[var(--bg-elevated)] to-[var(--bg-elevated)] p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[var(--brand)]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-32 w-32 rounded-full bg-[var(--accent)]/10 blur-3xl" />

        <div className="relative flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-deep)] text-white shadow-lg">
            <Sparkles size={21} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
              Mulai dari sini
            </p>
            <h2 className="mt-1 text-xl font-bold">Urutan cepat untuk pengguna baru</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ikuti alur berikut secara berurutan untuk menyiapkan bisnis sampai membaca laporan.
            </p>
          </div>
        </div>

        <div className="relative mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {quickStepIndexes.map((stepIndex, index) => {
            const step = steps[stepIndex];
            const Icon = step.icon;
            return (
            <a
              key={step.id}
              href={`#${step.id}`}
              className="group relative flex min-h-24 items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)]/80 p-3 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[var(--brand)]/40 hover:shadow-[var(--shadow)] sm:flex-col sm:items-start"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] transition group-hover:bg-[var(--brand)] group-hover:text-white">
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Langkah {index + 1}
                </span>
                <span className="mt-0.5 block text-sm font-semibold leading-tight">{step.title}</span>
              </span>
              {index < quickStepIndexes.length - 1 && (
                <ChevronRight
                  size={14}
                  className="hidden self-center text-[var(--muted)] xl:absolute xl:-right-2.5 xl:top-1/2 xl:z-10 xl:block xl:-translate-y-1/2"
                />
              )}
            </a>
            );
          })}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} />
          <div>
            <p className="font-semibold">Alur penjualan produk</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Produk → Transaksi → Penjualan Produk → pilih beberapa barang → atur qty → pilih akun →
              simpan. Setiap item tercatat sebagai pemasukan dan stok berkurang otomatis.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <section key={step.id} id={step.id} className="scroll-mt-28">
              <Card>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex flex-1 items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] font-bold text-[var(--brand)]">
                      {index + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <Icon size={18} className="text-[var(--brand)]" />
                        <h2 className="text-lg font-semibold">{step.title}</h2>
                      </div>
                      <ul className="mt-3 space-y-2">
                        {step.points.map((point) => (
                          <li key={point} className="flex gap-2 text-sm text-[var(--muted)]">
                            <CheckCircle2
                              size={15}
                              className="mt-0.5 shrink-0 text-[var(--success)]"
                            />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <Link
                    href={step.href}
                    className="inline-flex shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2 text-sm font-semibold text-[var(--brand)] transition hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
                  >
                    {step.action}
                  </Link>
                </div>
              </Card>
            </section>
          );
        })}
      </div>

      <Card className="mt-6">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-[var(--brand)]" />
          <h2 className="font-semibold">Tips agar laporan akurat</h2>
        </div>
        <ul className="mt-3 grid gap-2 text-sm text-[var(--muted)] md:grid-cols-2">
          <li>• Catat transaksi pada tanggal sebenarnya.</li>
          <li>• Pilih akun dan kategori yang tepat.</li>
          <li>• Jangan catat transfer sebagai pemasukan.</li>
          <li>• Periksa saldo dan laporan secara berkala.</li>
        </ul>
      </Card>
    </Protected>
  );
}
