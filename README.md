# Catetrek

Aplikasi pencatatan keuangan **realtime** untuk usaha kecil.

- **Frontend:** Next.js 15 + Tailwind
- **Backend:** Node.js (Express) + Prisma + Socket.io
- **Database:** MySQL (XAMPP / MariaDB)

## Fitur

- Auth (register, login, reset password, ubah password)
- Multi-bisnis & tim (OWNER / ADMIN / STAFF)
- Akun/dompet, kategori, transaksi (pemasukan/pengeluaran/transfer)
- Anggaran bulanan + peringatan
- Hutang & piutang
- Dashboard & laporan + export CSV
- Update tanpa reload via Socket.io
- Keamanan dasar: JWT, bcrypt, helmet, CORS, rate limit login, CSRF-safe Bearer auth, ownership per bisnis

## Menjalankan (Windows / NVM)

Pakai Node **18+** (disarankan 20/22). Jika default terminal masih Node 12:

```bash
export PATH="/c/Users/pc/AppData/Roaming/nvm/v22.11.0:$PATH"
```

### 1) Backend

Pastikan MySQL XAMPP sudah running, lalu:

```bash
cd backend
npm install
npx prisma db push
npm run db:seed
npm run dev
```

API: `http://localhost:4001`

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:3001`

## Akun seeder

| Field | Nilai |
|-------|-------|
| Nama | Iman |
| Bisnis | Manzcode |
| Email | yaelahman0810@gmail.com |
| Password | Anjay123 |

Seeder juga mengisi transaksi, anggaran, dan hutang/piutang untuk **Juli 2026**.

```bash
cd backend && npm run db:seed
```

## Environment

`backend/.env`

```
DATABASE_URL="mysql://root@localhost:3306/catetrek"
JWT_SECRET="ganti-di-production"
PORT=4001
FRONTEND_URL="http://localhost:3001"
```

`frontend/.env.local`

```
NEXT_PUBLIC_API_URL=http://localhost:4001
NEXT_PUBLIC_SOCKET_URL=http://localhost:4001
```
# catetrek
