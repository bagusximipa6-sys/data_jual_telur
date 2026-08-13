-- ============================================================
-- Buku Keuangan Usaha | Data Jual Telur
-- Skema Database untuk Vercel Postgres (Neon)
-- ============================================================

-- Tabel: Master Barang
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sell_price NUMERIC NOT NULL DEFAULT 0,
  buy_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabel: Master Pelanggan / Bakul
CREATE TABLE IF NOT EXISTS bakul_masters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabel: Barang Masuk (Stock In)
CREATE TABLE IF NOT EXISTS stock_in (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  buy_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabel: Barang Keluar (Stock Out / Penjualan)
CREATE TABLE IF NOT EXISTS stock_out (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  bakul_name TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  price NUMERIC NOT NULL DEFAULT 0,
  buy_price_snapshot NUMERIC NOT NULL DEFAULT 0,
  sale_type TEXT DEFAULT 'eceran',
  payment_method TEXT DEFAULT 'cash',
  created_by TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE stock_out ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'user';

-- Tabel: Riwayat Harga Barang (Price History)
-- Setiap perubahan harga dicatat sebagai entri baru (bukan UPDATE harga lama).
CREATE TABLE IF NOT EXISTS price_history (
  id TEXT PRIMARY KEY,
  barang_id TEXT NOT NULL,
  harga_beli NUMERIC NOT NULL DEFAULT 0,
  harga_jual NUMERIC NOT NULL DEFAULT 0,
  effective_at TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabel: Laporan Harian (Sales)
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date TEXT NOT NULL,
  modal_qty NUMERIC NOT NULL DEFAULT 0,
  modal_total NUMERIC NOT NULL DEFAULT 0,
  sale_qty NUMERIC NOT NULL DEFAULT 0,
  sale_total NUMERIC NOT NULL DEFAULT 0,
  shrink NUMERIC NOT NULL DEFAULT 0,
  target NUMERIC NOT NULL DEFAULT 0,
  gross_profit NUMERIC NOT NULL DEFAULT 0,
  difference NUMERIC NOT NULL DEFAULT 0,
  operational NUMERIC NOT NULL DEFAULT 0,
  net_profit NUMERIC NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabel: Rekaman Piutang Bakul
CREATE TABLE IF NOT EXISTS bakul_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  bill NUMERIC NOT NULL DEFAULT 0,
  paid NUMERIC NOT NULL DEFAULT 0,
  balance NUMERIC NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabel: Biaya Operasional
CREATE TABLE IF NOT EXISTS ops_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabel: Meta Aplikasi (JSONB untuk data dinamis / kategori)
CREATE TABLE IF NOT EXISTS app_meta (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ops_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INT NOT NULL DEFAULT 4,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inisialisasi satu baris meta default
INSERT INTO app_meta (id, ops_categories, version)
VALUES (1, '[]'::jsonb, 4)
ON CONFLICT (id) DO NOTHING;

-- Indeks untuk query umum
CREATE INDEX IF NOT EXISTS idx_stock_out_date ON stock_out (date);
CREATE INDEX IF NOT EXISTS idx_stock_out_bakul ON stock_out (bakul_name);
CREATE INDEX IF NOT EXISTS idx_stock_in_date ON stock_in (date);
CREATE INDEX IF NOT EXISTS idx_bakul_records_date ON bakul_records (date);
CREATE INDEX IF NOT EXISTS idx_ops_records_date ON ops_records (date);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales (date);
CREATE INDEX IF NOT EXISTS idx_price_history_barang ON price_history (barang_id);
