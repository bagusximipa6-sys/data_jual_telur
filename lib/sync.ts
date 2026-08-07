import type {
  BakulMaster,
  BakulRecord,
  DailySale,
  ItemMaster,
  OperationalRecord,
  StockInRecord,
  StockOutRecord,
} from "@/types/finance";

// Tipe dataset yang dikirim ke / disinkronkan dari server.
export type LocalDataset = {
  sales: DailySale[];
  bakulRecords: BakulRecord[];
  ops: OperationalRecord[];
  items: ItemMaster[];
  bakulMasters: BakulMaster[];
  stockIn: StockInRecord[];
  stockOut: StockOutRecord[];
  opsCategories: string[];
};

export type SyncStatus =
  | "loading" // mengambil data awal dari server
  | "saving" // sedang menyimpan ke server
  | "saved" // tersimpan di server
  | "error" // gagal menyimpan
  | "offline"; // tidak terhubung ke server

const EMPTY: LocalDataset = {
  sales: [],
  bakulRecords: [],
  ops: [],
  items: [],
  bakulMasters: [],
  stockIn: [],
  stockOut: [],
  opsCategories: [],
};

// Mengambil seluruh data dari endpoint server GET /api/data.
// Mengembalikan null jika gagal / tidak ada data.
export async function fetchAllFromServer(): Promise<Partial<LocalDataset> | null> {
  try {
    const res = await fetch("/api/data", { cache: "no-store" });
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
export async function pushAllToServer(data: LocalDataset): Promise<boolean> {
  try {
    const res = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { ok?: boolean };
    return json.ok === true;
  } catch {
    return false;
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
    opsCategories: [...EMPTY.opsCategories],
  };
}
