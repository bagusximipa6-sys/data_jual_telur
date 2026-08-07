import { db } from "@vercel/postgres";
import { ensureSchema } from "@/lib/migrate";
import type {
  BakulMaster,
  BakulRecord,
  DailySale,
  ItemMaster,
  OperationalRecord,
  StockInRecord,
  StockOutRecord,
} from "@/types/finance";

// === Tipe dataset lengkap ===
export type AppDataSet = {
  sales: DailySale[];
  bakulRecords: BakulRecord[];
  ops: OperationalRecord[];
  items: ItemMaster[];
  bakulMasters: BakulMaster[];
  stockIn: StockInRecord[];
  stockOut: StockOutRecord[];
  opsCategories: string[];
};

// Helper konversi NUMERIC -> number
const num = (v: unknown): number =>
  typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) || 0 : 0;

// === Tipe baris hasil query ===
type ItemRow = { id: string; name: string; sellPrice: number };
type BakulMasterRow = { id: string; name: string; address: string };
type StockInRow = { id: string; date: string; itemName: string; quantity: number; buyPrice: number };
type StockOutRow = {
  id: string;
  date: string;
  bakulName: string;
  itemName: string;
  quantity: number;
  price: number;
  saleType: string;
  paymentMethod: string;
};
type SaleRow = {
  date: string;
  modalQty: number;
  modalTotal: number;
  saleQty: number;
  saleTotal: number;
  shrink: number;
  target: number;
  grossProfit: number;
  difference: number;
  operational: number;
  netProfit: number;
  note: string;
};
type BakulRow = { date: string; name: string; bill: number; paid: number; balance: number; note: string };
type OpsRow = { date: string; description: string; amount: number; note: string };
type MetaRow = { opsCategories: string[] };

// === Load seluruh data dari DB ===
export async function loadAllData(): Promise<AppDataSet> {
  // Pastikan tabel sudah ada sebelum query dijalankan.
  await ensureSchema();
  const [itemsR, bakulMastersR, stockInR, stockOutR, salesR, bakulRecordsR, opsR, metaR] =
    await Promise.all([
      db.sql`SELECT id, name, sell_price AS "sellPrice" FROM items ORDER BY created_at ASC`,
      db.sql`SELECT id, name, address FROM bakul_masters ORDER BY created_at ASC`,
      db.sql`SELECT id, date, item_name AS "itemName", quantity, buy_price AS "buyPrice" FROM stock_in ORDER BY created_at ASC`,
      db.sql`SELECT id, date, bakul_name AS "bakulName", item_name AS "itemName", quantity, price, sale_type AS "saleType", payment_method AS "paymentMethod" FROM stock_out ORDER BY created_at ASC`,
      db.sql`SELECT date, modal_qty AS "modalQty", modal_total AS "modalTotal", sale_qty AS "saleQty", sale_total AS "saleTotal", shrink, target, gross_profit AS "grossProfit", difference, operational, net_profit AS "netProfit", note FROM sales ORDER BY position ASC, created_at ASC`,
      db.sql`SELECT date, name, bill, paid, balance, note FROM bakul_records ORDER BY position ASC, created_at ASC`,
      db.sql`SELECT date, description, amount, note FROM ops_records ORDER BY position ASC, created_at ASC`,
      db.sql`SELECT ops_categories AS "opsCategories" FROM app_meta WHERE id = 1`,
    ]);

  const items: ItemMaster[] = (itemsR.rows as unknown as ItemRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    sellPrice: num(r.sellPrice),
  }));

  const bakulMasters: BakulMaster[] = (bakulMastersR.rows as unknown as BakulMasterRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address ?? "",
  }));

  const stockIn: StockInRecord[] = (stockInR.rows as unknown as StockInRow[]).map((r) => ({
    id: r.id,
    date: r.date,
    itemName: r.itemName,
    quantity: num(r.quantity),
    buyPrice: num(r.buyPrice),
  }));

const stockOut: StockOutRecord[] = (stockOutR.rows as unknown as StockOutRow[]).map((r) => ({
    id: r.id,
    date: r.date,
    bakulName: r.bakulName,
    itemName: r.itemName,
    quantity: num(r.quantity),
    price: num(r.price),
    saleType: (r.saleType === "grosir" ? "grosir" : "eceran") as "eceran" | "grosir",
    paymentMethod: (r.paymentMethod === "transfer"
      ? "transfer"
      : r.paymentMethod === "hutang"
      ? "hutang"
      : "cash") as "cash" | "transfer" | "hutang",
  }));

  const sales: DailySale[] = (salesR.rows as unknown as SaleRow[]).map((r) => ({
    date: r.date,
    modalQty: num(r.modalQty),
    modalTotal: num(r.modalTotal),
    saleQty: num(r.saleQty),
    saleTotal: num(r.saleTotal),
    shrink: num(r.shrink),
    target: num(r.target),
    grossProfit: num(r.grossProfit),
    difference: num(r.difference),
    operational: num(r.operational),
    netProfit: num(r.netProfit),
    note: r.note ?? "",
  }));

  const bakulRecords: BakulRecord[] = (bakulRecordsR.rows as unknown as BakulRow[]).map((r) => ({
    date: r.date,
    name: r.name,
    bill: num(r.bill),
    paid: num(r.paid),
    balance: num(r.balance),
    note: r.note ?? "",
  }));

  const ops: OperationalRecord[] = (opsR.rows as unknown as OpsRow[]).map((r) => ({
    date: r.date,
    description: r.description,
    amount: num(r.amount),
    note: r.note ?? "",
  }));

  const metaRow = metaR.rows[0] as unknown as MetaRow | undefined;
  const opsCategories: string[] = Array.isArray(metaRow?.opsCategories)
    ? metaRow.opsCategories
    : [];

  return { sales, bakulRecords, ops, items, bakulMasters, stockIn, stockOut, opsCategories };
}

// === Simpan seluruh data (transaksi atomik) ===
export async function saveAllData(data: AppDataSet): Promise<void> {
  const {
    sales,
    bakulRecords,
    ops,
    items,
    bakulMasters,
    stockIn,
    stockOut,
opsCategories,
  } = data;

// Pastikan tabel sudah ada sebelum menulis.
  await ensureSchema();
const client = await db.connect();
  try {
    await client.sql`BEGIN`;
    await client.sql`DELETE FROM items`;
    await client.sql`DELETE FROM bakul_masters`;
    await client.sql`DELETE FROM stock_in`;
    await client.sql`DELETE FROM stock_out`;
    await client.sql`DELETE FROM sales`;
    await client.sql`DELETE FROM bakul_records`;
    await client.sql`DELETE FROM ops_records`;

    // Items
    for (const item of items) {
      await client.sql`
        INSERT INTO items (id, name, sell_price) VALUES (${item.id}, ${item.name}, ${item.sellPrice})
      `;
    }
    // Bakul masters
    for (const m of bakulMasters) {
      await client.sql`
        INSERT INTO bakul_masters (id, name, address) VALUES (${m.id}, ${m.name}, ${m.address ?? ""})
      `;
    }
    // Stock in
    for (const r of stockIn) {
      await client.sql`
        INSERT INTO stock_in (id, date, item_name, quantity, buy_price)
        VALUES (${r.id}, ${r.date}, ${r.itemName}, ${r.quantity}, ${r.buyPrice})
      `;
    }
    // Stock out
    for (const r of stockOut) {
      await client.sql`
        INSERT INTO stock_out (id, date, bakul_name, item_name, quantity, price, sale_type, payment_method)
        VALUES (${r.id}, ${r.date}, ${r.bakulName}, ${r.itemName}, ${r.quantity}, ${r.price}, ${r.saleType ?? "eceran"}, ${r.paymentMethod ?? "cash"})
      `;
    }
    // Sales
    for (let i = 0; i < sales.length; i++) {
      const s = sales[i];
      await client.sql`
        INSERT INTO sales (date, modal_qty, modal_total, sale_qty, sale_total, shrink, target, gross_profit, difference, operational, net_profit, note, position)
        VALUES (${s.date}, ${s.modalQty}, ${s.modalTotal}, ${s.saleQty}, ${s.saleTotal}, ${s.shrink}, ${s.target}, ${s.grossProfit}, ${s.difference}, ${s.operational}, ${s.netProfit}, ${s.note ?? ""}, ${i})
      `;
    }
    // Bakul records
    for (let i = 0; i < bakulRecords.length; i++) {
      const b = bakulRecords[i];
      await client.sql`
        INSERT INTO bakul_records (date, name, bill, paid, balance, note, position)
        VALUES (${b.date}, ${b.name}, ${b.bill}, ${b.paid}, ${b.balance}, ${b.note ?? ""}, ${i})
      `;
    }
    // Ops records
    for (let i = 0; i < ops.length; i++) {
      const o = ops[i];
      await client.sql`
        INSERT INTO ops_records (date, description, amount, note, position)
        VALUES (${o.date}, ${o.description}, ${o.amount}, ${o.note ?? ""}, ${i})
      `;
    }
    // Meta (ops_categories JSONB)
    await client.sql`
      UPDATE app_meta SET ops_categories = ${JSON.stringify(opsCategories)}::jsonb, updated_at = now() WHERE id = 1
    `;
    await client.sql`COMMIT`;
  } catch (err) {
    await client.sql`ROLLBACK`;
    throw err;
  } finally {
    client.release();
  }
}

// === Reset seluruh data ke awal kosong ===
export async function resetAllData(): Promise<void> {
  // Pastikan tabel sudah ada sebelum operasi reset.
  await ensureSchema();
  const client = await db.connect();
  try {
    await client.sql`BEGIN`;
    await client.sql`DELETE FROM items`;
    await client.sql`DELETE FROM bakul_masters`;
    await client.sql`DELETE FROM stock_in`;
    await client.sql`DELETE FROM stock_out`;
    await client.sql`DELETE FROM sales`;
    await client.sql`DELETE FROM bakul_records`;
    await client.sql`DELETE FROM ops_records`;
    await client.sql`UPDATE app_meta SET ops_categories = '[]'::jsonb, updated_at = now() WHERE id = 1`;
    await client.sql`COMMIT`;
  } catch (err) {
    await client.sql`ROLLBACK`;
    throw err;
  } finally {
    client.release();
  }
}
