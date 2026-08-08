import { BakulMaster, BakulRecord, DailySale, ItemMaster, OperationalRecord, PriceHistory, StockInRecord, StockOutRecord } from "@/types/finance";

// Tanggal hari ini dalam format ISO (YYYY-MM-DD) menggunakan zona waktu lokal.
export const todayISO = (): string => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

// Cek apakah sebuah tanggal (ISO) sudah terkunci (lebih kecil dari tanggal hari ini).
export const isLockedDate = (dateISO: string): boolean => {
  if (!dateISO) return false;
  return dateISO < todayISO();
};

// Ambil harga aktif (snapshot) dari PriceHistory berdasarkan tanggal transaksi.
// Mengembalikan entri PriceHistory dengan effectiveAt <= dateISO terbaru, atau null.
export function getActivePrice(
  priceHistory: PriceHistory[],
  barangId: string,
  dateISO: string
): PriceHistory | null {
  const candidates = priceHistory
    .filter((p) => p.barangId === barangId && p.effectiveAt <= dateISO)
    .sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt));
  return candidates[0] ?? null;
}

export const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export const shortNumber = (value: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);

export const toNumber = (value: string | number): number => {
  if (typeof value === "number") return value;
  if (!value) return 0;

  const v = value.trim();

  const fractionMatch = v.match(/^(\d+(?:[.,]\d+)?)?\s*(\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    const whole = fractionMatch[1] ? parseFloat(fractionMatch[1].replace(",", ".")) : 0;
    const numer = parseInt(fractionMatch[2], 10);
    const denom = parseInt(fractionMatch[3], 10);
    if (denom > 0) return whole + numer / denom;
  }

  // Normalize comma decimal separator, then parse
  const normalized = v.replace(/[^0-9.,\-]/g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : 0;
};

export const formatCurrencyInput = (value: string): string => {
  const clean = value.replace(/[^0-9]/g, "");
  if (!clean) return "";
  const num = parseInt(clean, 10);
  return new Intl.NumberFormat("id-ID").format(num);
};

export const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean))).sort();

export const getMonthLabel = (dateStr: string) => {
  if (!dateStr || dateStr.length < 7) return dateStr;
  const [year, month] = dateStr.split("-");
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const mIndex = parseInt(month, 10) - 1;
  if (mIndex >= 0 && mIndex < 12) {
    return `${monthNames[mIndex]} ${year}`;
  }
  return dateStr;
};

export const exportToCSV = <T extends Record<string, unknown>>(data: T[], filename: string) => {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((item) =>
    headers
      .map((header) => {
        const val = item[header];
        const stringVal = val === null || val === undefined ? "" : String(val);
        const escaped = stringVal.replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(",")
  );

  const csvContent = [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToJSON = (
  sales: DailySale[],
  bakulRecords: BakulRecord[],
  ops: OperationalRecord[],
  items: ItemMaster[] = [],
  bakulMasters: BakulMaster[] = [],
  stockIn: StockInRecord[] = [],
  stockOut: StockOutRecord[] = [],
  opsCategories: string[] = [],
  priceHistory: PriceHistory[] = [],
  filename: string = "buku_keuangan_backup"
) => {
  const payload = {
    version: 5,
    exportedAt: new Date().toISOString(),
    sales,
    bakulRecords,
    ops,
    items,
    bakulMasters,
    stockIn,
    stockOut,
    opsCategories,
    priceHistory,
  };
  const jsonContent = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
