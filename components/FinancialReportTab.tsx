"use client";

import { Button, Chip, Divider, Input, Tab, Tabs } from "@heroui/react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getMonthLabel, rupiah, shortNumber } from "@/lib/utils";
import {
  emptyPaymentBreakdown,
  OperationalRecord,
  PaymentBreakdown,
  PaymentMethod,
  ProfitLossSummary,
  Role,
  SaleBreakdown,
  SaleType,
  StockInRecord,
  StockOutRecord,
} from "@/types/finance";

interface FinancialReportTabProps {
  stockOut: StockOutRecord[];
  stockIn: StockInRecord[];
  ops: OperationalRecord[];
  role: Role;
}

// ===== Helpers to build Profit/Loss summary =====

const emptyBreakdown = (): SaleBreakdown => ({
  eceranQty: 0,
  eceranOmzet: 0,
  grosirQty: 0,
  grosirOmzet: 0,
  eceranCount: 0,
  grosirCount: 0,
});

const addToBreakdown = (
  bd: SaleBreakdown,
  saleType: SaleType | undefined,
  qty: number,
  omzet: number
) => {
  if (saleType === "grosir") {
    bd.grosirQty += qty;
    bd.grosirOmzet += omzet;
    bd.grosirCount += 1;
  } else {
    bd.eceranQty += qty;
    bd.eceranOmzet += omzet;
    bd.eceranCount += 1;
  }
};

const mergeBreakdown = (target: SaleBreakdown, source: SaleBreakdown) => {
  target.eceranQty += source.eceranQty;
  target.eceranOmzet += source.eceranOmzet;
  target.grosirQty += source.grosirQty;
  target.grosirOmzet += source.grosirOmzet;
  target.eceranCount += source.eceranCount;
  target.grosirCount += source.grosirCount;
};

const addToPaymentBreakdown = (
  bd: PaymentBreakdown,
  method: PaymentMethod | undefined,
  qty: number,
  omzet: number
) => {
  const m = method ?? "cash";
  if (m === "cash") {
    bd.cashQty += qty;
    bd.cashOmzet += omzet;
    bd.cashCount += 1;
  } else if (m === "transfer") {
    bd.transferQty += qty;
    bd.transferOmzet += omzet;
    bd.transferCount += 1;
  } else {
    bd.hutangQty += qty;
    bd.hutangOmzet += omzet;
    bd.hutangCount += 1;
  }
};

const mergePaymentBreakdown = (target: PaymentBreakdown, source: PaymentBreakdown) => {
  target.cashQty += source.cashQty;
  target.cashOmzet += source.cashOmzet;
  target.transferQty += source.transferQty;
  target.transferOmzet += source.transferOmzet;
  target.hutangQty += source.hutangQty;
  target.hutangOmzet += source.hutangOmzet;
  target.cashCount += source.cashCount;
  target.transferCount += source.transferCount;
  target.hutangCount += source.hutangCount;
};

const buildProfitLoss = (
  stockOut: StockOutRecord[],
  stockIn: StockInRecord[],
  ops: OperationalRecord[]
): ProfitLossSummary => {
  // Map item name -> buyPrice from latest Barang Masuk (stock in) record
  const buyPriceMap = new Map<string, number>();
  const sortedStockIn = [...stockIn].sort((a, b) => a.date.localeCompare(b.date));
  for (const record of sortedStockIn) {
    buyPriceMap.set(record.itemName.toLowerCase(), record.buyPrice);
  }

  // Map operational expenses by date
  const opsByDate = new Map<string, number>();
  for (const op of ops) {
    opsByDate.set(op.date, (opsByDate.get(op.date) ?? 0) + op.amount);
  }

  // Build daily items from each StockOut record
  const dailyMap = new Map<string, ProfitLossSummary["daily"][number]>();
  const sorted = [...stockOut].sort((a, b) => a.date.localeCompare(b.date));

  for (const record of sorted) {
    // Prioritas snapshot harga beli transaksi (Price History) -> fallback dari Stock In.
    const buyPrice =
      record.buyPriceSnapshot ??
      buyPriceMap.get(record.itemName.toLowerCase()) ??
      0;
    const omzet = record.quantity * record.price;
    const modalCost = record.quantity * buyPrice;
    const profit = omzet - modalCost;

const existing = dailyMap.get(record.date);
    const itemRow = {
      date: record.date,
      itemName: record.itemName,
      bakulName: record.bakulName,
      quantity: record.quantity,
      sellPrice: record.price,
      buyPrice,
      omzet,
      modalCost,
      profit,
      saleType: (record.saleType ?? "eceran") as SaleType,
      paymentMethod: record.paymentMethod,
      createdBy: record.createdBy,
    };

    if (existing) {
      existing.items.push(itemRow);
      existing.totalQuantity += record.quantity;
      existing.totalOmzet += omzet;
      existing.totalModal += modalCost;
      existing.totalProfit += profit;
      addToBreakdown(existing.saleBreakdown, record.saleType, record.quantity, omzet);
      addToPaymentBreakdown(existing.paymentBreakdown, record.paymentMethod, record.quantity, omzet);
    } else {
      const breakdown = emptyBreakdown();
      addToBreakdown(breakdown, record.saleType, record.quantity, omzet);
      const paymentBreakdown = emptyPaymentBreakdown();
      addToPaymentBreakdown(paymentBreakdown, record.paymentMethod, record.quantity, omzet);
      dailyMap.set(record.date, {
        date: record.date,
        totalQuantity: record.quantity,
        totalOmzet: omzet,
        totalModal: modalCost,
        totalProfit: profit,
        totalOperational: 0,
        netProfit: profit,
        saleBreakdown: breakdown,
        paymentBreakdown,
        items: [itemRow],
      });
    }
  }

  // Attach operational expense per date & compute net profit
  const daily = Array.from(dailyMap.values()).map((day) => {
    const totalOperational = opsByDate.get(day.date) ?? 0;
    return {
      ...day,
      totalOperational,
      netProfit: day.totalProfit - totalOperational,
    };
  });

// Weekly aggregation (week ending on Saturday, i.e. Sunday - Saturday)
  const weeklyMap = new Map<string, ProfitLossSummary["weekly"][number]>();
  const monthlyMap = new Map<string, ProfitLossSummary["monthly"][number]>();

  for (const day of daily) {
    const date = new Date(`${day.date}T00:00:00`);
    const dayIdx = date.getDay(); // 0 = Sun, 6 = Sat
    // Offset to reach the Saturday that ends the current week
    const saturdayOffset = (6 - dayIdx + 7) % 7;
    const saturday = new Date(date);
    saturday.setDate(date.getDate() + saturdayOffset);
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() - 6);

    const fmt = (d: Date) => {
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${d.getFullYear()}-${mm}-${dd}`;
    };

    const weekStart = fmt(sunday);
    const weekEnd = fmt(saturday);
    const weekKey = `${weekStart}|${weekEnd}`;
    const weekLabel = `${weekStart.slice(8, 10)} ${getShortMonth(weekStart)} - ${weekEnd.slice(8, 10)} ${getShortMonth(weekEnd)} (Sabtu)`;

const existingWeek = weeklyMap.get(weekKey);
    if (existingWeek) {
      existingWeek.totalQuantity += day.totalQuantity;
      existingWeek.totalOmzet += day.totalOmzet;
      existingWeek.totalModal += day.totalModal;
      existingWeek.totalProfit += day.totalProfit;
      existingWeek.totalOperational += day.totalOperational;
      existingWeek.netProfit += day.netProfit;
      mergeBreakdown(existingWeek.saleBreakdown, day.saleBreakdown);
      mergePaymentBreakdown(existingWeek.paymentBreakdown, day.paymentBreakdown);
    } else {
      weeklyMap.set(weekKey, {
        label: weekLabel,
        period: weekKey,
        totalQuantity: day.totalQuantity,
        totalOmzet: day.totalOmzet,
        totalModal: day.totalModal,
        totalProfit: day.totalProfit,
        totalOperational: day.totalOperational,
        netProfit: day.netProfit,
        saleBreakdown: { ...day.saleBreakdown },
        paymentBreakdown: { ...day.paymentBreakdown },
      });
    }

    const monthKey = day.date.slice(0, 7);
    const existingMonth = monthlyMap.get(monthKey);
    if (existingMonth) {
      existingMonth.totalQuantity += day.totalQuantity;
      existingMonth.totalOmzet += day.totalOmzet;
      existingMonth.totalModal += day.totalModal;
      existingMonth.totalProfit += day.totalProfit;
      existingMonth.totalOperational += day.totalOperational;
      existingMonth.netProfit += day.netProfit;
      mergeBreakdown(existingMonth.saleBreakdown, day.saleBreakdown);
      mergePaymentBreakdown(existingMonth.paymentBreakdown, day.paymentBreakdown);
    } else {
      monthlyMap.set(monthKey, {
        label: getMonthLabel(monthKey),
        period: monthKey,
        totalQuantity: day.totalQuantity,
        totalOmzet: day.totalOmzet,
        totalModal: day.totalModal,
        totalProfit: day.totalProfit,
        totalOperational: day.totalOperational,
        netProfit: day.netProfit,
        saleBreakdown: { ...day.saleBreakdown },
        paymentBreakdown: { ...day.paymentBreakdown },
      });
    }
  }

  const weekly = Array.from(weeklyMap.values()).sort((a, b) => a.period.localeCompare(b.period));
  const monthly = Array.from(monthlyMap.values()).sort((a, b) => a.period.localeCompare(b.period));

  const totalBreakdown = emptyBreakdown();
  const totalPaymentBreakdown = emptyPaymentBreakdown();
  for (const day of daily) {
    mergeBreakdown(totalBreakdown, day.saleBreakdown);
    mergePaymentBreakdown(totalPaymentBreakdown, day.paymentBreakdown);
  }

  return {
    daily,
    weekly,
    monthly,
    totalOmzet: daily.reduce((sum, d) => sum + d.totalOmzet, 0),
    totalModal: daily.reduce((sum, d) => sum + d.totalModal, 0),
    totalProfit: daily.reduce((sum, d) => sum + d.totalProfit, 0),
    totalOperational: daily.reduce((sum, d) => sum + d.totalOperational, 0),
    netProfit: daily.reduce((sum, d) => sum + d.netProfit, 0),
    totalQuantity: daily.reduce((sum, d) => sum + d.totalQuantity, 0),
    saleBreakdown: totalBreakdown,
    paymentBreakdown: totalPaymentBreakdown,
  };
};

const getShortMonth = (dateStr: string) => {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const month = parseInt(dateStr.slice(5, 7), 10) - 1;
  return monthNames[month] ?? dateStr;
};

const exportProfitCSV = (summary: ProfitLossSummary) => {
  const rows: string[][] = [
    [
      "Tanggal",
      "Total Qty",
      "Total Omzet",
      "Total Modal",
      "Total Laba Kotor",
      "Biaya Operasional",
      "Laba Bersih",
      "Qty Eceran",
      "Omzet Eceran",
      "Qty Grosir",
      "Omzet Grosir",
    ],
    ...summary.daily.map((d) => [
      d.date,
      String(d.totalQuantity),
      String(d.totalOmzet),
      String(d.totalModal),
      String(d.totalProfit),
      String(d.totalOperational),
      String(d.netProfit),
      String(d.saleBreakdown.eceranQty),
      String(d.saleBreakdown.eceranOmzet),
      String(d.saleBreakdown.grosirQty),
      String(d.saleBreakdown.grosirOmzet),
    ]),
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "laporan_laba_rugi.csv");
document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const exportProfitPDF = (summary: ProfitLossSummary) => {
  const doc = new jsPDF();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Laporan Keuangan & Laba Rugi", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Buku Keuangan Usaha - Data Jual Telur", 14, 22);
  doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, 14, 27);
  doc.setDrawColor(180);
  doc.line(14, 30, 196, 30);

  // Summary block
  let y = 36;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Ringkasan", 14, y);
  y += 6;
  const lines: Array<[string, string]> = [
    ["Total Barang Keluar", `${shortNumber(summary.totalQuantity)} kg`],
    ["Total Omzet / Penjualan", rupiah(summary.totalOmzet)],
    ["Total Modal (Harga Beli)", rupiah(summary.totalModal)],
    ["Total Laba Kotor", rupiah(summary.totalProfit)],
    ["Biaya Operasional", rupiah(summary.totalOperational)],
    ["Laba Bersih", rupiah(summary.netProfit)],
    ["Penjualan Eceran", `${shortNumber(summary.saleBreakdown.eceranQty)} kg • ${rupiah(summary.saleBreakdown.eceranOmzet)}`],
    ["Penjualan Grosir", `${shortNumber(summary.saleBreakdown.grosirQty)} kg • ${rupiah(summary.saleBreakdown.grosirOmzet)}`],
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  lines.forEach(([label, value]) => {
    doc.text(label, 16, y);
    doc.text(value, 130, y);
    y += 5.5;
  });

  // Monthly table
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Pendapatan Bulanan", 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [["Periode", "Qty (kg)", "Omzet", "Modal", "Laba Kotor", "Ops", "Laba Bersih"]],
    body: summary.monthly.map((row) => [
      row.label,
      shortNumber(row.totalQuantity),
      rupiah(row.totalOmzet),
      rupiah(row.totalModal),
      rupiah(row.totalProfit),
      rupiah(row.totalOperational),
      rupiah(row.netProfit),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [25, 23, 18], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 245, 239] },
  });

  // Weekly table
  const weeklyStart = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Pendapatan Mingguan", 14, weeklyStart);
  autoTable(doc, {
    startY: weeklyStart + 3,
    head: [["Periode Minggu", "Qty (kg)", "Omzet", "Modal", "Laba Kotor", "Ops", "Laba Bersih"]],
    body: summary.weekly.map((row) => [
      row.label,
      shortNumber(row.totalQuantity),
      rupiah(row.totalOmzet),
      rupiah(row.totalModal),
      rupiah(row.totalProfit),
      rupiah(row.totalOperational),
      rupiah(row.netProfit),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [25, 23, 18], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 245, 239] },
  });

  // Daily table
  const dailyStart = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Pendapatan Harian", 14, dailyStart);
  autoTable(doc, {
    startY: dailyStart + 3,
    head: [["Tanggal", "Qty (kg)", "Omzet", "Modal", "Laba Kotor", "Ops", "Laba Bersih"]],
    body: summary.daily
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((d) => [
        d.date,
        shortNumber(d.totalQuantity),
        rupiah(d.totalOmzet),
        rupiah(d.totalModal),
        rupiah(d.totalProfit),
        rupiah(d.totalOperational),
        rupiah(d.netProfit),
      ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [25, 23, 18], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 245, 239] },
  });

  doc.save("laporan_laba_rugi.pdf");
};

export function FinancialReportTab({ stockOut, stockIn, ops, role }: FinancialReportTabProps) {
  const [dateFilter, setDateFilter] = useState("");
  const [viewRole, setViewRole] = useState<Role | "all">("all");
  const isAdmin = role === "admin";

  const visibleStockOut = useMemo(() => {
    if (viewRole === "all") return stockOut;
    return stockOut.filter((r) => (r.createdBy ?? "user") === viewRole);
  }, [stockOut, viewRole]);

  const summary = useMemo(
    () => buildProfitLoss(visibleStockOut, stockIn, ops),
    [visibleStockOut, stockIn, ops]
  );

  const filteredDaily = useMemo(() => {
    if (!dateFilter) return summary.daily;
    return summary.daily.filter((d) => d.date === dateFilter);
  }, [summary.daily, dateFilter]);

  const ownerSummary = useMemo(() => {
    const ownerStockOut = stockOut.filter(r => r.createdBy === 'admin');
    return buildProfitLoss(ownerStockOut, stockIn, ops);
  }, [stockOut, stockIn, ops]);

  const userSummary = useMemo(() => {
    const userStockOut = stockOut.filter(r => r.createdBy !== 'admin');
    return buildProfitLoss(userStockOut, stockIn, ops);
  }, [stockOut, stockIn, ops]);

  const combinedSummary = useMemo(
    () => buildProfitLoss(stockOut, stockIn, ops),
    [stockOut, stockIn, ops]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#191712]/10 bg-white p-4 sm:px-6">
        <div>
          <h2 className="text-xl font-black text-[#191712]">Laporan Keuangan & Laba Rugi</h2>
          <p className="text-xs text-[#706858]">
            Pendapatan Harian = (Stok Keluar × Harga Jual) − (Stok Keluar × Harga Beli)
          </p>
        </div>
<div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            size="sm"
            className="w-full sm:w-[180px]"
            value={dateFilter}
            onValueChange={setDateFilter}
            aria-label="Filter Tanggal"
            radius="sm"
            isClearable
            onClear={() => setDateFilter("")}
          />
<Button
            size="sm"
            className="bg-[#191712] font-bold text-white"
            startContent={<FileSpreadsheet size={15} />}
            onPress={() => exportProfitCSV(summary)}
            radius="sm"
          >
            Export CSV
          </Button>
          <Button
            size="sm"
            variant="flat"
            className="bg-[#e6f1ff] font-bold text-[#173a61]"
            startContent={<FileText size={15} />}
            onPress={() => exportProfitPDF(summary)}
            radius="sm"
          >
            Export PDF
          </Button>
        </div>
      </div>

      {!isAdmin ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-medium text-amber-900">
          🔒 <strong>Laporan Keuangan & Laba Rugi</strong> khusus Owner (Mode Admin). Silakan buka Mode Admin
          terlebih dahulu untuk melihat laporan.
        </div>
      ) : (
        <>
{/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Laba Bersih Owner" value={rupiah(ownerSummary.netProfit)} tone="green" />
            <SummaryCard label="Laba Bersih User" value={rupiah(userSummary.netProfit)} tone="green" />
            <SummaryCard label="Laba Bersih Gabungan" value={rupiah(combinedSummary.netProfit)} tone="purple" />
            <SummaryCard label="Total Omzet Gabungan" value={rupiah(combinedSummary.totalOmzet)} tone="blue" />
          </div>

          {/* Role view switcher */}
          <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-[#191712]">Tampilan Laporan Laba Rugi</h3>
                <p className="text-xs text-[#706858]">Pilih data penjualan yang ingin Anda lihat: Owner, User, atau Gabungan.</p>
              </div>
              <Tabs
                fullWidth
                size="sm"
                radius="sm"
                selectedKey={viewRole}
                onSelectionChange={(key) => setViewRole(key as Role | "all")}
                classNames={{
                  tabList: "w-full sm:w-auto bg-[#f0eadb] shadow-inner p-1",
                  cursor: "bg-[#191712] shadow-sm",
                  tabContent: "font-bold text-[#6f6758] group-data-[selected=true]:text-white",
                }}
              >
                <Tab key="all" title="Gabungan" />
                <Tab key="admin" title="Owner" />
                <Tab key="user" title="User" />
              </Tabs>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Total Barang Keluar" value={`${shortNumber(summary.totalQuantity)} kg`} tone="plain" />
            <SummaryCard label="Total Omzet / Penjualan" value={rupiah(summary.totalOmzet)} tone="blue" />
            <SummaryCard label="Total Modal (Harga Beli)" value={rupiah(summary.totalModal)} tone="yellow" />
            <SummaryCard
              label="Total Laba Kotor"
              value={rupiah(summary.totalProfit)}
              tone={summary.totalProfit >= 0 ? "green" : "red"}
            />
          </div>

{/* Detail: Operasional & Grosir/Eceran */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Biaya Operasional"
              value={rupiah(summary.totalOperational)}
              tone="red"
            />
            <SummaryCard
              label="Laba Bersih (Setelah Ops)"
              value={rupiah(summary.netProfit)}
              tone={summary.netProfit >= 0 ? "green" : "red"}
            />
            <SummaryCard
              label="Penjualan Eceran"
              value={`${shortNumber(summary.saleBreakdown.eceranQty)} kg • ${rupiah(summary.saleBreakdown.eceranOmzet)}`}
              tone="blue"
            />
            <SummaryCard
              label="Penjualan Grosir"
              value={`${shortNumber(summary.saleBreakdown.grosirQty)} kg • ${rupiah(summary.saleBreakdown.grosirOmzet)}`}
              tone="purple"
            />
          </div>

          {/* Payment Method Breakdown */}
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              label="Pembayaran Cash"
              value={`${shortNumber(summary.paymentBreakdown.cashQty)} kg • ${rupiah(summary.paymentBreakdown.cashOmzet)}`}
              tone="green"
            />
            <SummaryCard
              label="Pembayaran Transfer"
              value={`${shortNumber(summary.paymentBreakdown.transferQty)} kg • ${rupiah(summary.paymentBreakdown.transferOmzet)}`}
              tone="blue"
            />
            <SummaryCard
              label="Pembayaran Hutang"
              value={`${shortNumber(summary.paymentBreakdown.hutangQty)} kg • ${rupiah(summary.paymentBreakdown.hutangOmzet)}`}
              tone="red"
            />
          </div>

          {/* Monthly Report */}
          <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-lg font-black text-[#191712]">Pendapatan Bulanan</h3>
              <p className="text-xs text-[#706858]">Akumulasi pendapatan & laba per bulan.</p>
            </div>
            <Divider className="bg-[#191712]/5" />
            {summary.monthly.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#706858]">
                Belum ada data penjualan untuk ditampilkan.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
<tr className="border-b border-[#191712]/10 text-[#706858]">
                      <th className="py-2 pr-4 font-bold">Periode</th>
                      <th className="py-2 pr-4 font-bold text-right">Qty (kg)</th>
                      <th className="py-2 pr-4 font-bold text-right">Omzet</th>
                      <th className="py-2 pr-4 font-bold text-right">Modal</th>
                      <th className="py-2 pr-4 font-bold text-right">Laba Kotor</th>
                      <th className="py-2 pr-4 font-bold text-right">Ops</th>
                      <th className="py-2 font-bold text-right">Laba Bersih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.monthly.map((row) => (
                      <tr key={row.period} className="border-b border-[#191712]/5">
                        <td className="py-2 pr-4 font-bold text-[#191712]">{row.label}</td>
                        <td className="py-2 pr-4 text-right font-mono">{shortNumber(row.totalQuantity)}</td>
                        <td className="py-2 pr-4 text-right font-mono">{rupiah(row.totalOmzet)}</td>
                        <td className="py-2 pr-4 text-right font-mono">{rupiah(row.totalModal)}</td>
                        <td className="py-2 pr-4 text-right font-mono">{rupiah(row.totalProfit)}</td>
                        <td className="py-2 pr-4 text-right font-mono text-[#8f321a]">{rupiah(row.totalOperational)}</td>
                        <td
                          className={`py-2 text-right font-mono font-black ${
                            row.netProfit >= 0 ? "text-[#1f8f5f]" : "text-[#8f321a]"
                          }`}
                        >
                          {rupiah(row.netProfit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Weekly Report */}
          <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm space-y-4">
            <div>
<h3 className="text-lg font-black text-[#191712]">Pendapatan Mingguan (per Sabtu)</h3>
              <p className="text-xs text-[#706858]">Akumulasi pendapatan & laba per minggu (Minggu - Sabtu).</p>
            </div>
            <Divider className="bg-[#191712]/5" />
            {summary.weekly.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#706858]">
                Belum ada data penjualan untuk ditampilkan.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#191712]/10 text-[#706858]">
                      <th className="py-2 pr-4 font-bold">Periode Minggu</th>
                      <th className="py-2 pr-4 font-bold text-right">Qty (kg)</th>
                      <th className="py-2 pr-4 font-bold text-right">Omzet</th>
                      <th className="py-2 pr-4 font-bold text-right">Modal</th>
                      <th className="py-2 pr-4 font-bold text-right">Laba Kotor</th>
                      <th className="py-2 pr-4 font-bold text-right">Ops</th>
                      <th className="py-2 font-bold text-right">Laba Bersih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.weekly.map((row) => (
                      <tr key={row.period} className="border-b border-[#191712]/5">
                        <td className="py-2 pr-4 font-bold text-[#191712]">{row.label}</td>
                        <td className="py-2 pr-4 text-right font-mono">{shortNumber(row.totalQuantity)}</td>
                        <td className="py-2 pr-4 text-right font-mono">{rupiah(row.totalOmzet)}</td>
                        <td className="py-2 pr-4 text-right font-mono">{rupiah(row.totalModal)}</td>
                        <td className="py-2 pr-4 text-right font-mono">{rupiah(row.totalProfit)}</td>
                        <td className="py-2 pr-4 text-right font-mono text-[#8f321a]">{rupiah(row.totalOperational)}</td>
                        <td
                          className={`py-2 text-right font-mono font-black ${
                            row.netProfit >= 0 ? "text-[#1f8f5f]" : "text-[#8f321a]"
                          }`}
                        >
                          {rupiah(row.netProfit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Daily Report Detail */}
          <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-black text-[#191712]">Pendapatan Harian</h3>
                <p className="text-xs text-[#706858]">
                  {dateFilter ? `Menampilkan tanggal ${dateFilter}` : "Seluruh tanggal penjualan"} • {filteredDaily.length} hari
                </p>
              </div>
              <Chip size="sm" className="bg-[#f0eadb] font-bold text-[#191712]">
                {filteredDaily.length} Hari
              </Chip>
            </div>
            <Divider className="bg-[#191712]/5" />
            {filteredDaily.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#706858]">
                Tidak ada data penjualan pada periode ini.
              </p>
            ) : (
              <div className="space-y-3">
                {filteredDaily
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((day) => (
                    <div key={day.date} className="rounded-xl border border-[#191712]/10 bg-[#f7f5ef] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="font-black text-[#191712]">{day.date}</h4>
                          <p className="text-[10px] text-[#706858] font-bold uppercase">
                            {day.items.length} transaksi • {shortNumber(day.totalQuantity)} kg
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-[#191712]">{rupiah(day.totalOmzet)}</p>
                          <p className="text-[10px] text-[#706858] font-bold">
                            Laba Kotor: <span className={day.totalProfit >= 0 ? "text-[#1f8f5f]" : "text-[#8f321a]"}>{rupiah(day.totalProfit)}</span>
                            {" • "}Ops: <span className="text-[#8f321a]">{rupiah(day.totalOperational)}</span>
                            {" • "}Laba Bersih: <span className={day.netProfit >= 0 ? "text-[#1f8f5f]" : "text-[#8f321a]"}>{rupiah(day.netProfit)}</span>
                          </p>
                        </div>
                      </div>

                      {/* Daily Eceran/Grosir breakdown */}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                        <span className="rounded-full bg-[#e6f1ff] px-2 py-0.5 text-[#173a61] uppercase tracking-wide">
                          Eceran: {shortNumber(day.saleBreakdown.eceranQty)} kg • {rupiah(day.saleBreakdown.eceranOmzet)}
                        </span>
                        <span className="rounded-full bg-[#f3e8ff] px-2 py-0.5 text-[#6b21a8] uppercase tracking-wide">
                          Grosir: {shortNumber(day.saleBreakdown.grosirQty)} kg • {rupiah(day.saleBreakdown.grosirOmzet)}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1">
                        {day.items.map((item, idx) => (
                          <div
                            key={`${item.date}-${item.itemName}-${item.bakulName}-${idx}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-[#191712]">{item.itemName}</span>
<span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                  item.saleType === "grosir"
                                    ? "bg-[#fff3cd] text-[#8f6b00]"
                                    : "bg-[#e7f5ec] text-[#1f8f5f]"
                                }`}
                              >
                                {item.saleType}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                  (item.paymentMethod ?? "cash") === "hutang"
                                    ? "bg-[#ffe2d8] text-[#8f321a]"
                                    : (item.paymentMethod ?? "cash") === "transfer"
                                    ? "bg-[#e6f1ff] text-[#173a61]"
                                    : "bg-[#f0eadb] text-[#191712]"
                                }`}
                              >
                                {item.paymentMethod ?? "cash"}
                              </span>
                              <span className="text-[#706858]"> • {item.bakulName}</span>
                            </div>
                            <div className="text-right font-mono">
                              <span className="text-[#706858]">
                                {shortNumber(item.quantity)} kg × {rupiah(item.sellPrice)} ={" "}
                              </span>
                              <span className="font-black text-[#191712]">{rupiah(item.omzet)}</span>
                              <span className="text-[#706858]"> (modal {rupiah(item.modalCost)})</span>
                              <span className={`font-black ${item.profit >= 0 ? "text-[#1f8f5f]" : "text-[#8f321a]"}`}>
                                {" "}
                                → {rupiah(item.profit)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex items-start gap-2 rounded-2xl border border-[#191712]/10 bg-white p-4 text-xs text-[#706858]">
        <Download size={15} className="mt-0.5 shrink-0" />
        <p>
<strong>Rumus:</strong> Pendapatan Harian = (Total Stok Keluar × Harga Jual) − (Total Stok Keluar × Harga
          Beli). Harga Beli diambil dari transaksi Barang Masuk terakhir untuk barang tersebut; jika belum ada data
          Barang Masuk, modal dihitung Rp0.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
label: string;
  value: string;
  tone: "plain" | "blue" | "yellow" | "green" | "red" | "purple";
}) {
  const tones = {
    plain: "bg-white border-zinc-200/80 text-[#191712]",
    blue: "bg-gradient-to-br from-[#e0f2fe] to-[#bae6fd] border-sky-300 text-sky-950",
    yellow: "bg-gradient-to-br from-[#fef9c3] to-[#fef08a] border-amber-300 text-amber-950",
    green: "bg-gradient-to-br from-[#ecfccb] to-[#d9f99d] border-lime-300 text-lime-950",
    red: "bg-gradient-to-br from-[#ffe4e6] to-[#fecdd3] border-rose-300 text-rose-950",
    purple: "bg-gradient-to-br from-[#f3e8ff] to-[#e9d5ff] border-purple-300 text-purple-950",
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.16em] opacity-80">{label}</p>
      <p className="mt-1 break-words text-xl font-black tracking-tight">{value}</p>
    </div>
  );
}
