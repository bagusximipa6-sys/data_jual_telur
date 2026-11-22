import { Pool } from "@neondatabase/serverless";
import type { PoolClient } from "@neondatabase/serverless";
import { ensureSchema } from "@/lib/migrate";
import type {
  BakulMaster,
  BakulRecord,
  DailySale,
  ItemMaster,
  OperationalRecord,
  PriceHistory,
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
  priceHistory: PriceHistory[];
  opsCategories: string[];
};

export type StockOutDelta = {
  upsert: StockOutRecord[];
  deletedIds: string[];
};

export type StockInDelta = {
  upsert: StockInRecord[];
  deletedIds: string[];
};

// Helper konversi NUMERIC -> number
const num = (v: unknown): number =>
  typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) || 0 : 0;

const MAX_QUERY_PARAMETERS = 60_000;
const MAX_BULK_INSERT_ROWS = 500;

async function withDatabase<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  try {
    const client = await pool.connect();
    try {
      return await callback(client);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function bulkInsert<T>(
  client: PoolClient,
  table: string,
  columns: string[],
  rows: T[],
  valuesForRow: (row: T, index: number) => unknown[],
  conflictClause = ""
): Promise<void> {
  if (rows.length === 0) return;

  const chunkSize = Math.max(
    1,
    Math.min(MAX_BULK_INSERT_ROWS, Math.floor(MAX_QUERY_PARAMETERS / columns.length))
  );
  const columnNames = columns.map((column) => `"${column}"`).join(", ");

  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const values: unknown[] = [];
    const placeholders = chunk.map((row, rowIndex) => {
      const rowValues = valuesForRow(row, offset + rowIndex);
      return `(${rowValues.map((value) => {
        values.push(value);
        return `$${values.length}`;
      }).join(", ")})`;
    });

    await client.query(
      `INSERT INTO "${table}" (${columnNames}) VALUES ${placeholders.join(", ")}${conflictClause}`,
      values
    );
  }
}

function uniqueById<T extends { id: string }>(records: T[]): T[] {
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

// === Tipe baris hasil query ===
type ItemRow = { id: string; name: string; sellPrice: number; buyPrice?: number };
type BakulMasterRow = { id: string; name: string; address: string };
type StockInRow = { id: string; date: string; itemName: string; quantity: number; buyPrice: number };
type StockOutRow = {
  id: string;
  date: string;
  bakulName: string;
  itemName: string;
  quantity: number;
  price: number;
  buyPriceSnapshot?: number;
  saleType: string;
  paymentMethod: string;
  createdBy: string;
};
type PriceHistoryRow = {
  id: string;
  barangId: string;
  hargaBeli: number;
  hargaJual: number;
  effectiveAt: string;
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
  return withDatabase(async (client) => {
    await ensureSchema(client);
    const [itemsR, bakulMastersR, stockInR, stockOutR, salesR, bakulRecordsR, opsR, metaR, priceHistoryR] =
      await Promise.all([
        client.query('SELECT id, name, sell_price AS "sellPrice", buy_price AS "buyPrice" FROM items ORDER BY created_at ASC'),
        client.query("SELECT id, name, address FROM bakul_masters ORDER BY created_at ASC"),
        client.query('SELECT id, date, item_name AS "itemName", quantity, buy_price AS "buyPrice" FROM stock_in ORDER BY created_at ASC'),
        client.query('SELECT id, date, bakul_name AS "bakulName", item_name AS "itemName", quantity, price, buy_price_snapshot AS "buyPriceSnapshot", sale_type AS "saleType", payment_method AS "paymentMethod", created_by AS "createdBy" FROM stock_out ORDER BY created_at ASC'),
        client.query('SELECT date, modal_qty AS "modalQty", modal_total AS "modalTotal", sale_qty AS "saleQty", sale_total AS "saleTotal", shrink, target, gross_profit AS "grossProfit", difference, operational, net_profit AS "netProfit", note FROM sales ORDER BY position ASC, created_at ASC'),
        client.query("SELECT date, name, bill, paid, balance, note FROM bakul_records ORDER BY position ASC, created_at ASC"),
        client.query("SELECT date, description, amount, note FROM ops_records ORDER BY position ASC, created_at ASC"),
        client.query('SELECT ops_categories AS "opsCategories" FROM app_meta WHERE id = 1'),
        client.query('SELECT id, barang_id AS "barangId", harga_beli AS "hargaBeli", harga_jual AS "hargaJual", effective_at AS "effectiveAt" FROM price_history ORDER BY effective_at ASC, created_at ASC'),
      ]);

  const items: ItemMaster[] = (itemsR.rows as unknown as ItemRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    sellPrice: num(r.sellPrice),
    buyPrice: r.buyPrice != null ? num(r.buyPrice) : 0,
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
    buyPriceSnapshot: r.buyPriceSnapshot != null ? num(r.buyPriceSnapshot) : 0,
    saleType: (r.saleType === "grosir" ? "grosir" : "eceran") as "eceran" | "grosir",
    paymentMethod: (r.paymentMethod === "transfer"
      ? "transfer"
      : r.paymentMethod === "hutang"
      ? "hutang"
      : "cash") as "cash" | "transfer" | "hutang",
    createdBy: (r.createdBy === "admin" ? "admin" : "user") as "user" | "admin",
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

  const priceHistory: PriceHistory[] = (priceHistoryR.rows as unknown as PriceHistoryRow[]).map((r) => ({
    id: r.id,
    barangId: r.barangId,
    hargaBeli: num(r.hargaBeli),
    hargaJual: num(r.hargaJual),
    effectiveAt: r.effectiveAt,
  }));

    return { sales, bakulRecords, ops, items, bakulMasters, stockIn, stockOut, priceHistory, opsCategories };
  });
}

// === Simpan seluruh data (transaksi atomik) ===
export async function saveAllData(
  data: AppDataSet,
  options?: {
    stockOutDelta?: StockOutDelta;
    stockInDelta?: StockInDelta;
    partialFields?: Set<keyof AppDataSet>;
  }
): Promise<void> {
  const {
    sales,
    bakulRecords,
    ops,
    items,
    bakulMasters,
    stockIn,
    stockOut,
    priceHistory,
    opsCategories,
  } = data;
  const partialFields = options?.partialFields;
  const shouldWrite = (field: keyof AppDataSet) => !partialFields || partialFields.has(field);

  return withDatabase(async (client) => {
    await ensureSchema(client);
    try {
    await client.query("BEGIN");
    if (shouldWrite("ops")) await client.query("DELETE FROM ops_records");
    if (shouldWrite("bakulRecords")) await client.query("DELETE FROM bakul_records");
    if (shouldWrite("sales")) await client.query("DELETE FROM sales");
    if (shouldWrite("priceHistory")) await client.query("DELETE FROM price_history");
    if (!options?.stockOutDelta && shouldWrite("stockOut")) {
      await client.query("DELETE FROM stock_out");
    }
    if (!options?.stockInDelta && shouldWrite("stockIn")) {
      await client.query("DELETE FROM stock_in");
    }
    if (shouldWrite("bakulMasters")) await client.query("DELETE FROM bakul_masters");
    if (shouldWrite("items")) await client.query("DELETE FROM items");

    // Items
    if (shouldWrite("items")) {
      await bulkInsert(client, "items", ["id", "name", "sell_price", "buy_price"], items,
        (item) => [item.id, item.name, item.sellPrice, item.buyPrice ?? 0]);
    }

    // Bakul masters
    if (shouldWrite("bakulMasters")) {
      await bulkInsert(client, "bakul_masters", ["id", "name", "address"], bakulMasters,
        (master) => [master.id, master.name, master.address ?? ""]);
    }

    // Stock in: delta requests only touch changed/deleted IDs.
    const stockInDelta = options?.stockInDelta;
    if (stockInDelta) {
      if (stockInDelta.deletedIds.length > 0) {
        await client.query("DELETE FROM stock_in WHERE id = ANY($1)", [stockInDelta.deletedIds]);
      }
      const upserts = uniqueById(stockInDelta.upsert);
      await bulkInsert(
        client,
        "stock_in",
        ["id", "date", "item_name", "quantity", "buy_price"],
        upserts,
        (record) => [record.id, record.date, record.itemName, record.quantity, record.buyPrice],
        ` ON CONFLICT (id) DO UPDATE SET
          date = EXCLUDED.date,
          item_name = EXCLUDED.item_name,
          quantity = EXCLUDED.quantity,
          buy_price = EXCLUDED.buy_price`
      );
    } else if (shouldWrite("stockIn")) {
      await bulkInsert(client, "stock_in", ["id", "date", "item_name", "quantity", "buy_price"], stockIn,
        (record) => [record.id, record.date, record.itemName, record.quantity, record.buyPrice]);
    }

    // Stock out: delta requests only touch changed/deleted IDs.
    const stockOutDelta = options?.stockOutDelta;
    if (stockOutDelta) {
      if (stockOutDelta.deletedIds.length > 0) {
        await client.query("DELETE FROM stock_out WHERE id = ANY($1)", [stockOutDelta.deletedIds]);
      }
      const upserts = uniqueById(stockOutDelta.upsert);
      await bulkInsert(
        client,
        "stock_out",
        ["id", "date", "bakul_name", "item_name", "quantity", "price", "buy_price_snapshot", "sale_type", "payment_method", "created_by"],
        upserts,
        (record) => [
          record.id,
          record.date,
          record.bakulName,
          record.itemName,
          record.quantity,
          record.price,
          record.buyPriceSnapshot ?? 0,
          record.saleType ?? "eceran",
          record.paymentMethod ?? "cash",
          record.createdBy ?? "user",
        ],
        ` ON CONFLICT (id) DO UPDATE SET
          date = EXCLUDED.date,
          bakul_name = EXCLUDED.bakul_name,
          item_name = EXCLUDED.item_name,
          quantity = EXCLUDED.quantity,
          price = EXCLUDED.price,
          buy_price_snapshot = EXCLUDED.buy_price_snapshot,
          sale_type = EXCLUDED.sale_type,
          payment_method = EXCLUDED.payment_method,
          created_by = EXCLUDED.created_by`
      );
    } else if (shouldWrite("stockOut")) {
      await bulkInsert(
        client,
        "stock_out",
        ["id", "date", "bakul_name", "item_name", "quantity", "price", "buy_price_snapshot", "sale_type", "payment_method", "created_by"],
        stockOut,
        (record) => [
          record.id,
          record.date,
          record.bakulName,
          record.itemName,
          record.quantity,
          record.price,
          record.buyPriceSnapshot ?? 0,
          record.saleType ?? "eceran",
          record.paymentMethod ?? "cash",
          record.createdBy ?? "user",
        ]
      );
    }

    // Price history
    if (shouldWrite("priceHistory")) {
      await bulkInsert(
        client,
        "price_history",
        ["id", "barang_id", "harga_beli", "harga_jual", "effective_at"],
        priceHistory,
        (record) => [record.id, record.barangId, record.hargaBeli, record.hargaJual, record.effectiveAt]
      );
    }

    // Sales
    if (shouldWrite("sales")) {
      await bulkInsert(
        client,
        "sales",
        ["date", "modal_qty", "modal_total", "sale_qty", "sale_total", "shrink", "target", "gross_profit", "difference", "operational", "net_profit", "note", "position"],
        sales,
        (record, index) => [
          record.date,
          record.modalQty,
          record.modalTotal,
          record.saleQty,
          record.saleTotal,
          record.shrink,
          record.target,
          record.grossProfit,
          record.difference,
          record.operational,
          record.netProfit,
          record.note ?? "",
          index,
        ]
      );
    }

    // Bakul records
    if (shouldWrite("bakulRecords")) {
      await bulkInsert(
        client,
        "bakul_records",
        ["date", "name", "bill", "paid", "balance", "note", "position"],
        bakulRecords,
        (record, index) => [
          record.date,
          record.name,
          record.bill,
          record.paid,
          record.balance,
          record.note ?? "",
          index,
        ]
      );
    }

    // Ops records
    if (shouldWrite("ops")) {
      await bulkInsert(
        client,
        "ops_records",
        ["date", "description", "amount", "note", "position"],
        ops,
        (record, index) => [record.date, record.description, record.amount, record.note ?? "", index]
      );
    }
    // Meta (ops_categories JSONB)
    if (shouldWrite("opsCategories")) {
      await client.query(
        "UPDATE app_meta SET ops_categories = $1::jsonb, updated_at = now() WHERE id = 1",
        [JSON.stringify(opsCategories)]
      );
    }
    await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  });
}

// === Reset seluruh data ke awal kosong ===
export async function resetAllData(): Promise<void> {
  await withDatabase(async (client) => {
    await ensureSchema(client);
    try {
    await client.query("BEGIN");
    await client.query("DELETE FROM ops_records");
    await client.query("DELETE FROM bakul_records");
    await client.query("DELETE FROM sales");
    await client.query("DELETE FROM price_history");
    await client.query("DELETE FROM stock_out");
    await client.query("DELETE FROM stock_in");
    await client.query("DELETE FROM bakul_masters");
    await client.query("DELETE FROM items");
    await client.query("UPDATE app_meta SET ops_categories = '[]'::jsonb, updated_at = now() WHERE id = 1");
    await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  });
}