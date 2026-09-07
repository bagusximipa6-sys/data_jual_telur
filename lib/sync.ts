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

export type StockOutDelta = {
  upsert: StockOutRecord[];
  deletedIds: string[];
};

export type StockInDelta = {
  upsert: StockInRecord[];
  deletedIds: string[];
};

// Tipe dataset yang dikirim ke / disinkronkan dari server.
export type LocalDataset = {
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

export type SyncStatus =
  | "loading" // mengambil data awal dari server
  | "saving" // sedang menyimpan ke server
  | "saved" // tersimpan di server
  | "error" // gagal menyimpan
  | "offline"; // tidak terhubung ke server

export type SyncResult = { ok: true } | { ok: false; error: string };

const REQUEST_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

const EMPTY: LocalDataset = {
  sales: [],
  bakulRecords: [],
  ops: [],
  items: [],
  bakulMasters: [],
  stockIn: [],
  stockOut: [],
  priceHistory: [],
  opsCategories: [],
};

// Mengambil seluruh data dari endpoint server GET /api/data.
// Mengembalikan null jika gagal / tidak ada data.
export async function fetchAllFromServer(): Promise<Partial<LocalDataset> | null> {
  try {
    const res = await fetchWithTimeout("/api/data", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; data?: Partial<LocalDataset> };
    if (!json.ok || !json.data) return null;
    return json.data;
  } catch {
    return null;
  }
}

// Menyimpan seluruh data ke server POST /api/data.
// Mengembalikan true jika berhasil.
export async function pushAllToServer(
  data: LocalDataset,
  stockOutBaseline?: StockOutRecord[],
  stockInBaseline?: StockInRecord[],
  datasetBaseline?: LocalDataset
): Promise<SyncResult> {
  try {
    let requestData: LocalDataset | (Omit<LocalDataset, "stockOut" | "stockIn"> & {
      stockOut?: StockOutRecord[];
      stockIn?: StockInRecord[];
      stockOutDelta?: StockOutDelta;
      stockInDelta?: StockInDelta;
    }) = data;
    let stockOutDelta: StockOutDelta | undefined;
    let stockInDelta: StockInDelta | undefined;

    if (stockOutBaseline) {
      const baselineById = new Map(stockOutBaseline.map((record) => [record.id, record]));
      const currentById = new Map(data.stockOut.map((record) => [record.id, record]));
      const upsert = data.stockOut.filter((record) => JSON.stringify(record) !== JSON.stringify(baselineById.get(record.id)));
      const deletedIds = stockOutBaseline
        .filter((record) => !currentById.has(record.id))
        .map((record) => record.id);
      stockOutDelta = { upsert, deletedIds };
    }

    if (stockInBaseline) {
      const baselineById = new Map(stockInBaseline.map((record) => [record.id, record]));
      const currentById = new Map(data.stockIn.map((record) => [record.id, record]));
      const upsert = data.stockIn.filter((record) => JSON.stringify(record) !== JSON.stringify(baselineById.get(record.id)));
      const deletedIds = stockInBaseline
        .filter((record) => !currentById.has(record.id))
        .map((record) => record.id);
      stockInDelta = { upsert, deletedIds };
    }

    if (datasetBaseline) {
      const partialData: Record<string, unknown> = { partial: true };
      const fields: (keyof LocalDataset)[] = [
        "sales", "bakulRecords", "ops", "items", "bakulMasters", "priceHistory", "opsCategories",
      ];
      for (const field of fields) {
        if (JSON.stringify(data[field]) !== JSON.stringify(datasetBaseline[field])) {
          partialData[field] = data[field];
        }
      }
      if (stockOutDelta) partialData.stockOutDelta = stockOutDelta;
      if (stockInDelta) partialData.stockInDelta = stockInDelta;
      if (!stockOutDelta && JSON.stringify(data.stockOut) !== JSON.stringify(datasetBaseline.stockOut)) {
        partialData.stockOut = data.stockOut;
      }
      if (!stockInDelta && JSON.stringify(data.stockIn) !== JSON.stringify(datasetBaseline.stockIn)) {
        partialData.stockIn = data.stockIn;
      }
      requestData = partialData as typeof requestData;
    } else if (stockOutDelta || stockInDelta) {
      const { stockOut: fullStockOut, stockIn: fullStockIn, ...withoutDeltaRecords } = data;
      requestData = {
        ...withoutDeltaRecords,
        ...(stockOutDelta ? {} : { stockOut: fullStockOut }),
        ...(stockInDelta ? {} : { stockIn: fullStockIn }),
        ...(stockOutDelta ? { stockOutDelta } : {}),
        ...(stockInDelta ? { stockInDelta } : {}),
      };
    }

    const payload = JSON.stringify(requestData);
    let body: BodyInit = payload;
    const headers: HeadersInit = { "Content-Type": "application/json" };

    // Kurangi ukuran request tanpa mengubah bentuk payload yang dipahami server.
    if (typeof CompressionStream !== "undefined") {
      const compressed = new Response(
        new Blob([payload]).stream().pipeThrough(new CompressionStream("gzip"))
      );
      body = await compressed.blob();
      headers["Content-Encoding"] = "gzip";
    }

    const res = await fetchWithTimeout("/api/data", {
      method: "POST",
      headers,
      body,
    });
    const response = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || response.ok !== true) {
      return { ok: false, error: response.error || `Server mengembalikan HTTP ${res.status}.` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof DOMException && error.name === "AbortError"
        ? "Server tidak merespons dalam 30 detik."
        : "Tidak dapat terhubung ke server.",
    };
  }
}

// Memeriksa apakah server sudah memiliki data (tidak kosong).
export function hasAnyServerData(d: Partial<LocalDataset> | null): boolean {
  if (!d) return false;
  const arrays: unknown[][] = [
    d.sales as unknown[],
    d.bakulRecords as unknown[],
    d.ops as unknown[],
    d.items as unknown[],
    d.bakulMasters as unknown[],
    d.stockIn as unknown[],
    d.stockOut as unknown[],
    d.priceHistory as unknown[],
  ];
  const hasData =
    arrays.some((arr) => Array.isArray(arr) && arr.length > 0) ||
    (Array.isArray(d.opsCategories) && d.opsCategories.length > 0);
  return hasData;
}

// Membangun dataset lokal default (kosong) untuk fallback.
export function emptyDataset(): LocalDataset {
  return {
    sales: [...EMPTY.sales],
    bakulRecords: [...EMPTY.bakulRecords],
    ops: [...EMPTY.ops],
    items: [...EMPTY.items],
bakulMasters: [...EMPTY.bakulMasters],
    stockIn: [...EMPTY.stockIn],
    stockOut: [...EMPTY.stockOut],
    priceHistory: [...EMPTY.priceHistory],
    opsCategories: [...EMPTY.opsCategories],
  };
}
