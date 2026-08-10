export type DailySale = {
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

export type BakulRecord = {
  date: string;
  name: string;
  bill: number;
  paid: number;
  balance: number;
  note: string;
};

export type OperationalRecord = {
  date: string;
  description: string;
  amount: number;
  note: string;
};

export type ItemMaster = {
  id: string;
  name: string;
  sellPrice: number;
  buyPrice?: number;
};

// Riwayat Harga Barang (Price History)
// Setiap perubahan harga barang dicatat sebagai entri baru (append-only).
export type PriceHistory = {
  id: string;
  barangId: string;
  hargaBeli: number;
  hargaJual: number;
  effectiveAt: string; // format ISO date: YYYY-MM-DD
  createdAt?: string;
};

export type BakulMaster = {
  id: string;
  name: string;
  address: string;
};

export type StockInRecord = {
  id: string;
  date: string;
  itemName: string;
  quantity: number;
  buyPrice: number;
};

export type StockOutRecord = {
  id: string;
  date: string;
  bakulName: string;
  itemName: string;
  quantity: number;
  price: number;
  buyPriceSnapshot?: number; // snapshot harga beli pada saat transaksi
  saleType?: "eceran" | "grosir";
  paymentMethod?: "cash" | "transfer" | "hutang";
  createdBy?: Role;
};

export type PiutangPayment = {
  id: string;
  date: string;
  bakulName: string;
  amount: number;
  note: string;
};

export type Role = "user" | "admin";

export type FinanceSummary = {
  modal: number;
  penjualan: number;
  opFromSales: number;
  opDetail: number;
  labaKotor: number;
  labaBersih: number;
  piutang: number;
  dibayar: number;
  target: number;
  penyusutan: number;
};

export type BakulSummaryItem = {
  name: string;
  bill: number;
  paid: number;
  balance: number;
  count: number;
};

// ===== Laporan Harian & Laba Rugi =====

export type SaleType = "eceran" | "grosir";

export type PaymentMethod = "cash" | "transfer" | "hutang";

export type SaleBreakdown = {
  eceranQty: number;
  eceranOmzet: number;
  grosirQty: number;
  grosirOmzet: number;
  eceranCount: number;
  grosirCount: number;
};

export type PaymentBreakdown = {
  cashQty: number;
  cashOmzet: number;
  transferQty: number;
  transferOmzet: number;
  hutangQty: number;
  hutangOmzet: number;
  cashCount: number;
  transferCount: number;
  hutangCount: number;
};

export const emptyPaymentBreakdown = (): PaymentBreakdown => ({
  cashQty: 0,
  cashOmzet: 0,
  transferQty: 0,
  transferOmzet: 0,
  hutangQty: 0,
  hutangOmzet: 0,
  cashCount: 0,
  transferCount: 0,
  hutangCount: 0,
});

export type DailyReportItem = {
  date: string;
  itemName: string;
  bakulName: string;
  quantity: number;
  sellPrice: number;
  buyPrice: number;
  omzet: number; // qty * sellPrice
  modalCost: number; // qty * buyPrice
  profit: number; // omzet - modalCost
  saleType: SaleType;
  paymentMethod?: PaymentMethod;
};

export type DailyReport = {
  date: string;
  totalQuantity: number;
  totalOmzet: number;
  totalModal: number;
  totalProfit: number;
  totalOperational: number;
  netProfit: number;
  saleBreakdown: SaleBreakdown;
  paymentBreakdown: PaymentBreakdown;
  items: DailyReportItem[];
};

export type PeriodProfit = {
  label: string;
  period: string;
  totalQuantity: number;
  totalOmzet: number;
  totalModal: number;
  totalProfit: number;
  totalOperational: number;
  netProfit: number;
  saleBreakdown: SaleBreakdown;
  paymentBreakdown: PaymentBreakdown;
};

export type ProfitLossSummary = {
  daily: DailyReport[];
  weekly: PeriodProfit[];
  monthly: PeriodProfit[];
  totalOmzet: number;
  totalModal: number;
  totalProfit: number;
  totalOperational: number;
  netProfit: number;
  totalQuantity: number;
  saleBreakdown: SaleBreakdown;
  paymentBreakdown: PaymentBreakdown;
};
