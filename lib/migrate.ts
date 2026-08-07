import { db } from "@vercel/postgres";

// Skema database (CREATE TABLE IF NOT EXISTS) yang idempotent.
// Bisa dijalankan berulang kali dengan aman.
// Disesuaikan dengan sql/schema.sql.
const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sell_price NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS bakul_masters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS stock_in (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 0,
    buy_price NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS stock_out (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    bakul_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 0,
    price NUMERIC NOT NULL DEFAULT 0,
    sale_type TEXT DEFAULT 'eceran',
    payment_method TEXT DEFAULT 'cash',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sales (
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
  )`,
  `CREATE TABLE IF NOT EXISTS bakul_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    bill NUMERIC NOT NULL DEFAULT 0,
    paid NUMERIC NOT NULL DEFAULT 0,
    balance NUMERIC NOT NULL DEFAULT 0,
    note TEXT DEFAULT '',
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS ops_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    note TEXT DEFAULT '',
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS app_meta (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    ops_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    version INT NOT NULL DEFAULT 4,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `INSERT INTO app_meta (id, ops_categories, version)
   VALUES (1, '[]'::jsonb, 4)
   ON CONFLICT (id) DO NOTHING`,
  `CREATE INDEX IF NOT EXISTS idx_stock_out_date ON stock_out (date)`,
  `CREATE INDEX IF NOT EXISTS idx_stock_out_bakul ON stock_out (bakul_name)`,
  `CREATE INDEX IF NOT EXISTS idx_stock_in_date ON stock_in (date)`,
  `CREATE INDEX IF NOT EXISTS idx_bakul_records_date ON bakul_records (date)`,
  `CREATE INDEX IF NOT EXISTS idx_ops_records_date ON ops_records (date)`,
  `CREATE INDEX IF NOT EXISTS idx_sales_date ON sales (date)`,
];

// Menjalankan skema terhadap database.
// Idempotent: aman dipanggil berulang kali.
let schemaInitialized = false;
let schemaPromise: Promise<void> | null = null;

export async function ensureSchema(): Promise<void> {
  // Hindari eksekusi berulang dalam satu proses server.
  if (schemaInitialized) return;
  if (schemaPromise) return schemaPromise;

schemaPromise = (async () => {
    const client = await db.connect();
    try {
      const c = client as unknown as { query: (text: string) => Promise<unknown> };
      for (const stmt of SCHEMA_STATEMENTS) {
        await c.query(stmt);
      }
      schemaInitialized = true;
    } finally {
      client.release();
    }
  })();

  return schemaPromise;
}
