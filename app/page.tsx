"use client";

import { Button, Input } from "@heroui/react";
import { motion } from "framer-motion";
import {
  Boxes,
  CircleDollarSign,
  ClipboardList,
  Database,
  FileBarChart,
  HandCoins,
  Package,
  PackagePlus,
  ShoppingCart,
  Tag,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

import { BakulTab } from "@/components/BakulTab";
import { FinancialReportTab } from "@/components/FinancialReportTab";
import { Header } from "@/components/Header";
import { MasterTab } from "@/components/MasterTab";
import { MetricCard } from "@/components/MetricCard";
import { OpsTab } from "@/components/OpsTab";
import { StockInTab } from "@/components/StockInTab";
import { StockOutTab } from "@/components/StockOutTab";
import { useAppData, type AppDataSet } from "@/hooks/useAppData";
import { useAuth } from "@/hooks/useAuth";
import { rupiah, shortNumber, unique } from "@/lib/utils";
import {
  BakulMaster,
  BakulRecord,
  ItemMaster,
  OperationalRecord,
  PriceHistory,
  StockInRecord,
  StockOutRecord,
} from "@/types/finance";

export default function Home() {
const { state, dispatch, isClient, loading, loadError, lockError, syncStatus, reload, handleResetData, priceHistory, isRecordLocked } =
    useAppData();
  const { sales, bakulRecords, ops, items, bakulMasters, stockIn, stockOut, opsCategories } = state;
  const { role, adminUnlocked, handleUnlockAdmin, handleLogoutAdmin, handleRoleChange } = useAuth();

  const [menu, setMenu] = useState("dashboard");

  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [reportDate, setReportDate] = useState<string>(() => {
    const latest = [...stockOut]
      .map((r) => r.date)
      .sort()
      .reverse()[0];
    return latest || new Date().toISOString().slice(0, 10);
  });

  const menuGroups = useMemo(
    () => [
      {
        title: "Laporan",
        items: [
          { key: "dashboard", label: "Laporan Harian", icon: ClipboardList, adminOnly: false },
          { key: "laporan", label: "Laba & Rugi", icon: FileBarChart, adminOnly: false },
        ],
      },
      {
        title: "Transaksi",
        items: [
          { key: "stockin", label: "Barang Masuk", icon: PackagePlus, adminOnly: true },
          { key: "stockout", label: "Barang Keluar", icon: Package, adminOnly: false },
          { key: "ops", label: "Operasional", icon: HandCoins, adminOnly: true },
        ],
      },
      {
        title: "Data & Pengaturan",
        items: [
          { key: "bakul", label: "Piutang Bakul", icon: Users, adminOnly: false },
          { key: "master", label: "Master & Data", icon: Database, adminOnly: false },
        ],
      },
    ],
    []
  );

// Derive the effective menu during render: if a user role is on an admin-only menu,
  // fall back to "dashboard" instead of resetting state in an effect.
  const lockedKeys = useMemo(() => {
    const allMenus = menuGroups.flatMap((g) => g.items);
    return new Set(allMenus.filter((m) => m.adminOnly).map((m) => m.key));
  }, [menuGroups]);
  const effectiveMenu = role === "user" && lockedKeys.has(menu) ? "dashboard" : menu;

  // Filter menu yang terlihat berdasarkan role (admin/user)
  const visibleMenuGroups = useMemo(() => {
    return menuGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => role === "admin" || !item.adminOnly),
      }))
      .filter((group) => group.items.length > 0);
  }, [role, menuGroups]);

  // Extract available months for dropdown
  const availableMonths = useMemo(() => {
    const months = sales.map((s) => s.date.slice(0, 7));
    return unique(months).sort().reverse();
  }, [sales]);

  // Filtered data by month
  const filteredBakul = useMemo(() => {
    if (selectedMonth === "all") return bakulRecords;
    return bakulRecords.filter((b) => b.date.startsWith(selectedMonth));
  }, [bakulRecords, selectedMonth]);

  // Filter stockOut records based on role. Admin sees all, user sees their own.
  const visibleStockOut = useMemo(() => {
    if (role === "admin") return stockOut;
    // When createdBy is not set, assume it's visible to all for backward compatibility.
    return stockOut.filter((r) => (r.createdBy ?? "user") === "user");
  }, [stockOut, role]);

  // === Laporan Harian: rekap barang keluar & omzet per tanggal ===
  const availableReportDates = useMemo(
    () => unique(visibleStockOut.map((r) => r.date)).sort().reverse(),
    [visibleStockOut]
  );

  const dailyRecords = useMemo(
    () => visibleStockOut.filter((r) => r.date === reportDate),
    [visibleStockOut, reportDate]
  );

  const dailyQty = useMemo(() => dailyRecords.reduce((sum, r) => sum + r.quantity, 0), [dailyRecords]);
  const dailyOmzet = useMemo(() => dailyRecords.reduce((sum, r) => sum + r.quantity * r.price, 0), [dailyRecords]);

const dailyItemSummary = useMemo(() => {
    const map = new Map<string, { qty: number; omzet: number }>();
    for (const r of dailyRecords) {
      const cur = map.get(r.itemName) ?? { qty: 0, omzet: 0 };
      cur.qty += r.quantity;
      cur.omzet += r.quantity * r.price;
      map.set(r.itemName, cur);
    }
    return Array.from(map.entries());
  }, [dailyRecords]);

  // Sisa stok = total stok masuk − total stok keluar (kumulatif s.d. tanggal laporan)
  const dailyStockRemaining = useMemo(() => {
    const stockInTotal = stockIn
      .filter((r) => r.date <= reportDate)
      .reduce((sum, r) => sum + r.quantity, 0);
    const stockOutTotal = visibleStockOut
      .filter((r) => r.date <= reportDate)
      .reduce((sum, r) => sum + r.quantity, 0);
    return stockInTotal - stockOutTotal;
  }, [stockIn, visibleStockOut, reportDate]);

  // === Harga Telur Hari Ini ===
  // Sumber: Master Barang (sellPrice) + transaksi Barang Keluar pada tanggal terpilih
  const eggPrices = useMemo(() => {
    const itemMap = new Map(items.map((item) => [item.name.toLowerCase(), item]));

    // Aggregasi harga jual riil dari transaksi Barang Keluar pada hari ini (rata-rata berbobot quantity)
    const todaySellMap = new Map<string, { total: number; qty: number }>();
    for (const r of dailyRecords) {
      const key = r.itemName.toLowerCase();
      const cur = todaySellMap.get(key) ?? { total: 0, qty: 0 };
      cur.total += r.price * r.quantity;
      cur.qty += r.quantity;
      todaySellMap.set(key, cur);
    }

    const todaySellPrice = (name: string) => {
      const rec = todaySellMap.get(name.toLowerCase());
      return rec && rec.qty > 0 ? rec.total / rec.qty : null;
    };

    const names = unique([...items.map((i) => i.name), ...dailyRecords.map((r) => r.itemName)]);
    return names
      .filter((n) => n.trim().length > 0)
      .map((name) => {
        const master = itemMap.get(name.toLowerCase());
        const sellToday = todaySellPrice(name);
        return {
          name,
          sellPrice: master?.sellPrice ?? null,
          sellToday,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, dailyRecords]);

const bakulNames = useMemo(() => unique(bakulMasters.map((item) => item.name)), [bakulMasters]);
  const itemNames = useMemo(() => unique(items.map((item) => item.name)), [items]);
  const categories = useMemo(
    () => unique([...opsCategories, ...ops.map((item) => item.description)]),
    [opsCategories, ops]
  );

  // Handlers
  // CRUD Bakul
  const handleAddBakul = (newRecord: BakulRecord) => {
    dispatch({ type: "ADD", payload: { field: "bakulRecords", value: newRecord } });
  };
  const handleUpdateBakul = (index: number, updatedRecord: BakulRecord) => {
    dispatch({ type: "UPDATE", payload: { field: "bakulRecords", index, value: updatedRecord } });
  };
  const handleDeleteBakul = (index: number) => {
    dispatch({ type: "DELETE", payload: { field: "bakulRecords", index } });
  };

  // CRUD Master Barang
  const handleAddItem = (newItem: ItemMaster) => {
    dispatch({ type: "ADD", payload: { field: "items", value: newItem } });
  };
  const handleUpdateItem = (index: number, updatedItem: ItemMaster) => {
    dispatch({ type: "UPDATE", payload: { field: "items", index, value: updatedItem } });
  };
  const handleDeleteItem = (index: number) => {
    dispatch({ type: "DELETE", payload: { field: "items", index } });
  };

  // CRUD Riwayat Harga (Price History)
  const handleAddPriceHistory = (record: PriceHistory) => {
    dispatch({ type: "ADD", payload: { field: "priceHistory", value: record } });
  };

  // CRUD Master Pelanggan / Bakul
  const handleAddBakulMaster = (newMaster: BakulMaster) => {
    dispatch({ type: "ADD", payload: { field: "bakulMasters", value: newMaster } });
  };
  const handleUpdateBakulMaster = (index: number, updatedMaster: BakulMaster) => {
    dispatch({ type: "UPDATE", payload: { field: "bakulMasters", index, value: updatedMaster } });
  };
  const handleDeleteBakulMaster = (index: number) => {
    dispatch({ type: "DELETE", payload: { field: "bakulMasters", index } });
  };

  // CRUD Transaksi Barang Masuk
  const handleAddStockIn = (record: StockInRecord) => {
    dispatch({ type: "ADD", payload: { field: "stockIn", value: record } });
  };
  const handleUpdateStockIn = (index: number, record: StockInRecord) => {
    dispatch({ type: "UPDATE", payload: { field: "stockIn", index, value: record } });
  };
  const handleDeleteStockIn = (index: number) => {
    dispatch({ type: "DELETE", payload: { field: "stockIn", index } });
  };

// CRUD Transaksi Barang Keluar / Penjualan
  const handleAddStockOut = (record: StockOutRecord) => {
    dispatch({ type: "ADD", payload: { field: "stockOut", value: record } });
  };
  const handleUpdateStockOut = (index: number, record: StockOutRecord) => {
    dispatch({ type: "UPDATE", payload: { field: "stockOut", index, value: record } });
  };
  const handleDeleteStockOut = (index: number) => {
    dispatch({ type: "DELETE", payload: { field: "stockOut", index } });
  };

  // CRUD Biaya Operasional
  const handleAddOps = (record: OperationalRecord) => {
    dispatch({ type: "ADD", payload: { field: "ops", value: record } });
  };
  const handleUpdateOps = (index: number, record: OperationalRecord) => {
    dispatch({ type: "UPDATE", payload: { field: "ops", index, value: record } });
  };
  const handleDeleteOps = (index: number) => {
    dispatch({ type: "DELETE", payload: { field: "ops", index } });
  };

  // CRUD Master Kategori Operasional
  const handleAddOpsCategory = (category: string) => {
    const trimmed = category.trim();
    if (!trimmed) return;
    if (!opsCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      dispatch({ type: "SET_FIELD", payload: { field: "opsCategories", value: [...opsCategories, trimmed] } });
    }
  };
  const handleDeleteOpsCategory = (category: string) => {
    dispatch({
      type: "SET_FIELD",
      payload: { field: "opsCategories", value: opsCategories.filter((c) => c !== category) },
    });
  };

// JSON Import & Reset
  const handleImportData = (data: Partial<AppDataSet>) => {
    const fullData = { ...state, ...data };
    dispatch({ type: "SET_ALL_DATA", payload: fullData });
  };

if (!isClient || loading) {
    return (
      <main className="min-h-screen bg-[#f8f7f2]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
          <p className="mt-4 text-center text-sm text-[#706858]">Memuat data dari server…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] text-[#191712]">
      {/* Tampilkan banner error saat gagal memuat */}
      {loadError && (
        <div className="bg-[#ffe2d8] border-b border-[#8f321a]/20 px-4 py-3 text-sm font-bold text-[#8f321a] flex flex-wrap items-center justify-between gap-2">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={reload}
            className="rounded-lg bg-[#8f321a] px-3 py-1 text-xs font-bold text-white"
          >
            Coba Lagi
          </button>
        </div>
      )}
      {lockError && (
        <div className="bg-[#fff3cd] border-b border-amber-300 px-4 py-3 text-sm font-bold text-amber-900">
          🔒 {lockError}
        </div>
      )}
      {/* Header Bar */}
<Header
        stockOutCount={stockOut.length}
        role={role}
        adminUnlocked={adminUnlocked}
        onRoleChange={handleRoleChange}
        onUnlockAdmin={handleUnlockAdmin}
        onLogoutAdmin={handleLogoutAdmin}
        selectedMonth={selectedMonth}
        availableMonths={availableMonths}
        onMonthChange={setSelectedMonth}
        syncStatus={syncStatus}
      />

      {/* Main Container */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="rounded-2xl bg-white/70 p-2 shadow-sm backdrop-blur-sm border border-[#191712]/5">
<nav className="flex flex-row flex-nowrap items-stretch gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:gap-4 sm:overflow-visible sm:pb-0">
            {visibleMenuGroups.map((group) => (
              <div key={group.title} className="flex items-center gap-2">
                <div className="flex flex-row items-center gap-2 sm:items-center sm:gap-2">
                  {group.items.map(({ key, label, icon: Icon }) => {
const active = effectiveMenu === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setMenu(key)}
                        className={`group flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-center transition-all sm:shrink sm:flex-row sm:px-3 sm:py-2 w-[72px] sm:w-auto ${
                          active
                            ? "bg-[#191712] text-white shadow-md"
                            : "bg-[#f7f5ef] text-[#706858] hover:bg-[#f0eadb] hover:text-[#191712]"
                        }`}
                      >
                        <Icon
                          size={18}
                          className={`shrink-0 ${
                            active ? "text-[#d9ff67]" : "text-[#706858] group-hover:text-[#191712]"
                          }`}
                        />
                        <span className="text-[10px] font-bold leading-tight sm:text-[11px] sm:font-semibold">
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Dynamic Tab Content */}
<motion.div key={effectiveMenu} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
{effectiveMenu === "dashboard" && (
            <div className="space-y-6">
              {/* Laporan Harian Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#191712]/10 bg-white p-4 sm:px-6">
                <div>
                  <h2 className="text-xl font-black text-[#191712]">Laporan Harian</h2>
                  <p className="text-xs text-[#706858]">
                    Rekap total barang keluar dan total omzet / penjualan pada hari tersebut.
                  </p>
                </div>
<div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    size="sm"
                    className="w-full sm:w-[180px]"
                    value={reportDate}
                    onValueChange={setReportDate}
                    aria-label="Pilih Tanggal Laporan"
                    radius="sm"
                  />
                </div>
              </div>

{/* Daily Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label={`Total Barang Keluar • ${reportDate}`}
                  value={`${shortNumber(dailyQty)} kg`}
                  tone="blue"
                  icon={Package}
                />
                <MetricCard
                  label={`Total Omzet / Penjualan`}
                  value={rupiah(dailyOmzet)}
                  tone="green"
                  icon={CircleDollarSign}
                />
                <MetricCard
                  label={`Sisa Stok • ${reportDate}`}
                  value={`${shortNumber(dailyStockRemaining)} kg`}
                  tone="yellow"
                  icon={Boxes}
                />
                <MetricCard
                  label="Jumlah Transaksi"
                  value={`${dailyRecords.length} Transaksi`}
                  tone="plain"
                  icon={ShoppingCart}
                />
              </div>

              {/* Harga Telur Hari Ini */}
              <div className="overflow-hidden rounded-2xl border border-[#191712]/10 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-[#191712]/10 bg-gradient-to-r from-[#d9ff67] to-[#b3e619] px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Tag size={18} className="text-[#191712]" />
                    <h3 className="text-base font-black text-[#191712]">Harga Telur Hari Ini</h3>
                  </div>
                  <span className="rounded-full bg-[#191712]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#191712]">
                    {reportDate}
                  </span>
                </div>

                <div className="p-5">
                  {eggPrices.length === 0 ? (
                    <p className="py-6 text-center text-sm text-[#706858]">
                      Belum ada data harga. Tambahkan barang di <strong>Master &amp; Cadangan</strong> atau catat
                      transaksi Barang Keluar.
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
{eggPrices.map((item) => {
                        // Prioritas: Harga Master Barang (Rp 23.000), lalu rata-rata transaksi hari ini
                        const displayPrice = item.sellPrice ?? item.sellToday;
                        const hasPrice = displayPrice != null;
                        return (
                          <div
                            key={item.name}
                            className="relative overflow-hidden rounded-xl border border-[#191712]/10 bg-gradient-to-br from-[#f7f5ef] to-white p-4"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-black text-[#191712]">{item.name}</p>
                                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#706858]">
                                  {item.sellPrice != null ? "Harga master" : "Harga transaksi"}
                                </p>
                              </div>
                              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#191712]/5 text-[#191712]">
                                <TrendingUp size={16} />
                              </span>
                            </div>

                            <div className="mt-3">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-[#706858]">
                                Harga Jual / kg
                              </p>
                              <p
                                className={`font-mono text-2xl font-black tracking-tight ${
                                  hasPrice ? "text-[#1f8f5f]" : "text-[#b0a99a]"
                                }`}
                              >
                                {hasPrice ? rupiah(displayPrice) : "—"}
                              </p>
                              {item.sellToday != null && item.sellPrice != null && item.sellToday !== item.sellPrice && (
                                <p className="mt-1 text-[10px] font-bold text-[#706858]">
                                  Rata-rata transaksi hari ini: {rupiah(item.sellToday)} / kg
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Per-item Summary */}
              {dailyItemSummary.length > 0 && (
                <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm space-y-3">
                  <h3 className="font-black text-sm text-[#191712]">Rekap Per Barang</h3>
                  <div className="flex flex-wrap gap-2">
                    {dailyItemSummary.map(([name, { qty, omzet }]) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-2 rounded-full bg-[#f7f5ef] border border-[#191712]/10 px-3 py-1.5 text-xs font-bold"
                      >
                        {name}: {shortNumber(qty)} kg • {rupiah(omzet)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Detail Transaksi Harian */}
              <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-black text-[#191712]">Detail Barang Keluar</h3>
                    <p className="text-xs text-[#706858]">
                      Tanggal {reportDate} • {dailyRecords.length} transaksi
                    </p>
                  </div>
                  {availableReportDates.length > 1 && (
                    <div className="flex flex-wrap gap-1">
                      {availableReportDates.slice(0, 7).map((d) => (
                        <Button
                          key={d}
                          size="sm"
                          radius="sm"
                          className={
                            d === reportDate
                              ? "bg-[#191712] font-bold text-white"
                              : "bg-[#f0eadb] font-bold text-[#191712]"
                          }
                          onPress={() => setReportDate(d)}
                        >
                          {d.slice(5)}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                {dailyRecords.length === 0 ? (
                  <p className="py-10 text-center text-sm text-[#706858]">
                    Belum ada barang keluar / penjualan pada tanggal ini.
                  </p>
                ) : (
                  <div className="space-y-2">
{dailyRecords.map((record) => (
                      <div
                        key={record.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f7f5ef] px-4 py-3 text-xs"
                      >
                        <div>
<div className="flex items-center gap-2">
                            <p className="font-black text-sm text-[#191712]">{record.itemName}</p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                (record.saleType ?? "eceran") === "grosir"
                                  ? "bg-[#fff3cd] text-[#8f6b00]"
                                  : "bg-[#e7f5ec] text-[#1f8f5f]"
                              }`}
                            >
                              {record.saleType ?? "eceran"}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                (record.paymentMethod ?? "cash") === "hutang"
                                  ? "bg-[#ffe2d8] text-[#8f321a]"
                                  : (record.paymentMethod ?? "cash") === "transfer"
                                  ? "bg-[#e6f1ff] text-[#173a61]"
                                  : "bg-[#f0eadb] text-[#191712]"
                              }`}
                            >
                              {record.paymentMethod ?? "cash"}
                            </span>
                          </div>
                          <p className="text-[#706858]">{record.bakulName} • Harga jual {rupiah(record.price)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-black text-[#191712]">{shortNumber(record.quantity)} kg</p>
                          <p className="font-mono font-bold text-[#1f8f5f]">{rupiah(record.quantity * record.price)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

{effectiveMenu === "stockin" && (
            <StockInTab
              stockIn={stockIn}
              itemNames={itemNames}
              role={role}
              priceHistory={priceHistory}
              isRecordLocked={isRecordLocked}
              onAddStockIn={handleAddStockIn}
              reportDate={reportDate}
              onReportDateChange={setReportDate}
              onUpdateStockIn={handleUpdateStockIn}
              onDeleteStockIn={handleDeleteStockIn}
            />
          )}

{effectiveMenu === "stockout" && (
<StockOutTab
              stockOut={visibleStockOut}
              itemNames={itemNames}
              bakulNames={bakulNames}
              items={items}
              priceHistory={priceHistory}
              isRecordLocked={isRecordLocked}
              onAddStockOut={handleAddStockOut}
              reportDate={reportDate}
              onReportDateChange={setReportDate}
              onUpdateStockOut={handleUpdateStockOut}
              onDeleteStockOut={handleDeleteStockOut}
              onAddBakul={handleAddBakul}
              role={role}
            />
          )}

{effectiveMenu === "bakul" && (
<BakulTab
              bakulRecords={filteredBakul}
              bakulNames={bakulNames}
              role={role}
              isRecordLocked={() => false}
              onAddBakul={handleAddBakul}
              onUpdateBakul={handleUpdateBakul}
              onDeleteBakul={handleDeleteBakul}
            />
          )}

{effectiveMenu === "ops" && (
<OpsTab
              ops={ops}
              categories={categories}
              role={role}
              isRecordLocked={isRecordLocked}
              onAddOps={handleAddOps}
              onUpdateOps={handleUpdateOps}
              onDeleteOps={handleDeleteOps}
              onAddOpsCategory={handleAddOpsCategory}
            />
          )}

{effectiveMenu === "laporan" && (
            <FinancialReportTab stockOut={stockOut} stockIn={stockIn} ops={ops} role={role} />
          )}

{effectiveMenu === "master" && (
            <MasterTab
              categories={categories}
              sales={sales}
              bakulRecords={bakulRecords}
              ops={ops}
              items={items}
              bakulMasters={bakulMasters}
              stockIn={stockIn}
              stockOut={stockOut}
              priceHistory={priceHistory}
              opsCategories={opsCategories}
              role={role}
              onAddItem={handleAddItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onAddPriceHistory={handleAddPriceHistory}
              onAddBakulMaster={handleAddBakulMaster}
              onUpdateBakulMaster={handleUpdateBakulMaster}
              onDeleteBakulMaster={handleDeleteBakulMaster}
              onAddOpsCategory={handleAddOpsCategory}
              onDeleteOpsCategory={handleDeleteOpsCategory}
              onImportData={handleImportData}
              onResetData={handleResetData}
            />
          )}
        </motion.div>
      </section>
    </main>
  );
}
