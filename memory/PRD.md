# Yulia Kitchen — POS F&B (Bahasa Indonesia)

## Problem Statement
Aplikasi POS/kasir modern, cepat, mobile-friendly untuk bisnis F&B kecil Indonesia. 100% Bahasa Indonesia, format Rupiah (Rp10.000). Awalnya konsep coffee stall (KopiPOS), lalu diubah menjadi **Yulia Kitchen** — fokus minuman segar (Mojito, Es Teh, Jus, dll) + makanan, tanpa kopi. Tema hijau segar.

## Architecture
- Backend: FastAPI + MongoDB (motor), single `server.py`. Semua route prefix `/api`.
- Frontend: React 19 + CRA(craco) + Tailwind + shadcn/ui + react-query + recharts. Alias `@/`.
- Auth: JWT (Bearer di localStorage + httpOnly cookie). 2 role: owner, cashier.
- Object storage: Emergent objstore untuk upload logo/QRIS/foto produk.

## User Personas
- Pemilik/Admin (owner): akses penuh (Kasir, Pesanan, Produk, Stok, Riwayat, Laporan, Pengaturan).
- Kasir (cashier): hanya Kasir, Pesanan, Riwayat Transaksi.

## Core Requirements (static)
- Kasir cepat (grid produk + cart), varian/add-on/sweetness/ice + catatan item.
- Pembayaran Tunai (quick cash + kembalian) & QRIS (tandai sudah dibayar).
- Struk thermal 58/80mm (browser print + Web Bluetooth ESC/POS).
- Manajemen produk (CRUD), stok (in/out/adjust + riwayat), pesanan (status pipeline), riwayat transaksi (filter), laporan (KPI + grafik), pengaturan (pajak/servis, logo, QRIS).
- Cegah stok negatif, cegah double submit (idempotency client_txn_id).

## Implemented (2026-06)
- [x] Auth JWT + RBAC + seed owner/cashier (2026-08-24)
- [x] Kasir POS lengkap: grid, search, filter kategori, options modal, cart, checkout Tunai/QRIS, success screen + struk (2026-08-24)
- [x] Pesanan, Produk CRUD, Stok, Riwayat, Laporan (recharts), Pengaturan + upload (2026-08-24)
- [x] Backend + frontend E2E test: 100% pass (iteration_1)
- [x] Rebrand ke **Yulia Kitchen**, tema hijau segar (Bricolage Grotesque), menu diubah ke minuman segar tanpa kopi, kategori: Makanan/Mojito/Es Teh/Jus/Minuman/Dessert/Snack/Paket. 18 produk seed. (2026-08-24)

## Backlog / Remaining
- P1: Diskon per transaksi/item; cetak struk otomatis via printer default.
- P2: Multi-cashier report per kasir; export laporan CSV/PDF; manajemen user dari UI.

## Test Credentials
- Owner: owner@kopipos.id / owner123
- Kasir: kasir@kopipos.id / kasir123
