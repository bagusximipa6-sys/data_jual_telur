"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type {
  DailySale,
  BakulRecord,
  OperationalRecord,
  ItemMaster,
  BakulMaster,
  StockInRecord,
  StockOutRecord,
  PriceHistory,
} from "@/types/finance";
import {
  initialSales,
  initialBakulRecords,
  initialOperationalRecords,
  initialItems,
  initialBakulMasters,
  initialStockIn,
  initialStockOut,
  initialOpsCategories,
  initialPriceHistory,
} from "@/app/rpa-data";
import {
  fetchAllFromServer,
  hasAnyServerData,
  pushAllToServer,
  emptyDataset,
  type LocalDataset,
  type SyncStatus,
} from "@/lib/sync";
import { isLockedDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

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

function subscribeToClient() {
  return () => {};
}

export function useAppData() {
  const isClient = useSyncExternalStore(subscribeToClient, () => true, () => false);
  const { adminUnlocked } = useAuth();

  const [sales, setSales] = useState<DailySale[]>(initialSales as DailySale[]);
  const [bakulRecords, setBakulRecords] = useState<BakulRecord[]>(initialBakulRecords as BakulRecord[]);
  const [ops, setOps] = useState<OperationalRecord[]>(initialOperationalRecords as OperationalRecord[]);
  const [items, setItems] = useState<ItemMaster[]>(initialItems as ItemMaster[]);
  const [bakulMasters, setBakulMasters] = useState<BakulMaster[]>(initialBakulMasters as BakulMaster[]);
  const [stockIn, setStockIn] = useState<StockInRecord[]>(initialStockIn as StockInRecord[]);
  const [stockOut, setStockOut] = useState<StockOutRecord[]>(initialStockOut as StockOutRecord[]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>(initialPriceHistory as PriceHistory[]);
  const [opsCategories, setOpsCategories] = useState<string[]>(initialOpsCategories as string[]);

  const [dataLoaded, setDataLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");

  // Guard agar inisialisasi tidak berjalan dua kali.
  const initStarted = useRef(false);

  // Membangun dataset gabungan untuk dikirim ke server / dipakai aplikasi.
  const state: AppDataSet = useMemo(
    () => ({ sales, bakulRecords, ops, items, bakulMasters, stockIn, stockOut, priceHistory, opsCategories }),
    [sales, bakulRecords, ops, items, bakulMasters, stockIn, stockOut, priceHistory, opsCategories]
  );

  // Satu-effect inisialisasi: tentukan sumber kebenaran.
  // - Server punya data  -> pakai data server (sumber kebenaran).
  // - Server kosong      -> seed data awal (demo) ke server.
  // - Server tidak dapat diakses -> mode offline, pakai data lokal awal.
  useEffect(() => {
    if (!isClient || initStarted.current) return;
    initStarted.current = true;

    const initializeData = async () => {
      setLoading(true);
      setLoadError(null);
      setSyncStatus("loading");
      const serverData = await fetchAllFromServer();

      if (serverData === null) {
        // Jaringan / server bermasalah, aplikasi offline.
        setSyncStatus("offline");
        setLoading(false);
        return;
      }

      if (hasAnyServerData(serverData)) {
        // Server punya data -> sumber kebenaran.
        setSales(serverData.sales ?? []);
        setBakulRecords(serverData.bakulRecords ?? []);
        setOps(serverData.ops ?? []);
        setItems(serverData.items ?? []);
        setBakulMasters(serverData.bakulMasters ?? []);
        setStockIn(serverData.stockIn ?? []);
        setStockOut(serverData.stockOut ?? []);
        setPriceHistory(serverData.priceHistory ?? []);
        setOpsCategories(serverData.opsCategories ?? []);
        setSyncStatus("saved");
      } else {
        // Server kosong. Seed dengan data awal (demo).
        const demoData: LocalDataset = {
          sales: initialSales as DailySale[],
          bakulRecords: initialBakulRecords as BakulRecord[],
          ops: initialOperationalRecords as OperationalRecord[],
          items: initialItems as ItemMaster[],
          bakulMasters: initialBakulMasters as BakulMaster[],
          stockIn: initialStockIn as StockInRecord[],
          stockOut: initialStockOut as StockOutRecord[],
          priceHistory: initialPriceHistory as PriceHistory[],
          opsCategories: initialOpsCategories as string[],
        };
        setSyncStatus("saving");
        const success = await pushAllToServer(demoData);
        setSyncStatus(success ? "saved" : "error");
      }
      setDataLoaded(true);
      setLoading(false);
    };

    initializeData();
  }, [isClient]);

  // Simpan data ke server setiap kali data berubah (debounce).
  // Tidak dibatasi hanya admin, sehingga perubahan dari mode user pun ter-sinkron.
  useEffect(() => {
    if (!isClient || !dataLoaded) return;
    if (syncStatus === "loading" || syncStatus === "offline") return;

    const dataset: LocalDataset = {
      sales,
      bakulRecords,
      ops,
      items,
      bakulMasters,
      stockIn,
      stockOut,
      priceHistory,
      opsCategories,
    };

    const timer = setTimeout(async () => {
      setSyncStatus("saving");
      const success = await pushAllToServer(dataset);
      setSyncStatus(success ? "saved" : "error");
    }, 800);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, dataLoaded, syncStatus === "offline", sales, bakulRecords, ops, items, bakulMasters, stockIn, stockOut, priceHistory, opsCategories]);

// Tipe action yang didukung dispatch (kompatibel dengan pemakaian lama).
  type ActionMap = {
    SET_ALL_DATA: AppDataSet;
    RESET_DATA: undefined;
    SET_FIELD: { [K in keyof AppDataSet]: { field: K; value: AppDataSet[K] } }[keyof AppDataSet];
    ADD: { [K in keyof AppDataSet]: { field: K; value: AppDataSet[K][0] } }[keyof AppDataSet];
    UPDATE: {
      [K in keyof AppDataSet]: { field: K; index: number; value: AppDataSet[K][0] };
    }[keyof AppDataSet];
    DELETE: { field: keyof AppDataSet; index: number };
  };
  type Action =
    | {
        [K in keyof ActionMap]: {
          type: K;
          payload: ActionMap[K];
        };
      }[keyof ActionMap]
    | { type: "SET_ALL_DATA"; payload: AppDataSet }
    | { type: "RESET_DATA"; payload?: undefined };

  // CRUD dispatch yang update state individu.
  const dispatch = useCallback((action: Action) => {
    const field = action.type === "SET_FIELD" || action.type === "ADD" || action.type === "UPDATE" || action.type === "DELETE"
      ? (action.payload as { field: keyof AppDataSet }).field
      : undefined;

    if (action.type === "SET_ALL_DATA") {
      const data = action.payload as AppDataSet;
      setSales(data.sales ?? []);
      setBakulRecords(data.bakulRecords ?? []);
      setOps(data.ops ?? []);
      setItems(data.items ?? []);
      setBakulMasters(data.bakulMasters ?? []);
      setStockIn(data.stockIn ?? []);
      setStockOut(data.stockOut ?? []);
      setPriceHistory(data.priceHistory ?? []);
      setOpsCategories(data.opsCategories ?? []);
      return;
    }

    if (action.type === "RESET_DATA") {
      setSales(initialSales as DailySale[]);
      setBakulRecords(initialBakulRecords as BakulRecord[]);
      setOps(initialOperationalRecords as OperationalRecord[]);
      setItems(initialItems as ItemMaster[]);
      setBakulMasters(initialBakulMasters as BakulMaster[]);
      setStockIn(initialStockIn as StockInRecord[]);
      setStockOut(initialStockOut as StockOutRecord[]);
      setPriceHistory(initialPriceHistory as PriceHistory[]);
      setOpsCategories(initialOpsCategories as string[]);
      return;
    }

    if (!field) return;

    const isArray = field !== "opsCategories";
    if (!isArray) {
      // opsCategories: string[]
      if (action.type === "SET_FIELD") {
        setOpsCategories((action.payload as { value: string[] }).value);
      }
      return;
    }

    if (action.type === "SET_FIELD") {
      const value = (action.payload as { value: unknown }).value;
      switch (field) {
        case "sales": setSales(value as DailySale[]); break;
        case "bakulRecords": setBakulRecords(value as BakulRecord[]); break;
        case "ops": setOps(value as OperationalRecord[]); break;
        case "items": setItems(value as ItemMaster[]); break;
        case "bakulMasters": setBakulMasters(value as BakulMaster[]); break;
        case "stockIn": setStockIn(value as StockInRecord[]); break;
        case "stockOut": setStockOut(value as StockOutRecord[]); break;
        case "priceHistory": setPriceHistory(value as PriceHistory[]); break;
        default: break;
      }
      return;
    }

// --- Guard Daily Lock: blokir ubah/hapus rekaman tanggal lampau ---
    // Catatan: "bakulRecords" (Piutang Bakul) sengaja dihapus dari daftar ini
    // agar pengguna dapat menambah/mengubah/menghapus piutang pada hari sebelumnya.
    const lockedFields = new Set(["sales", "ops", "stockIn", "stockOut"]);
    if (lockedFields.has(field) && (action.type === "UPDATE" || action.type === "DELETE" || action.type === "ADD")) {
      const payload = action.payload as { index?: number; value?: unknown };
      const index = payload.index;
      let date: string | undefined;
      if (action.type === "DELETE") {
        const arr = field === "sales"
          ? sales
          : field === "bakulRecords"
          ? bakulRecords
          : field === "ops"
          ? ops
          : field === "stockIn"
          ? stockIn
          : stockOut;
        date = index !== undefined ? arr[index]?.date : undefined;
      } else {
        date = (payload.value as { date?: string } | undefined)?.date;
      }
      if (date && isLockedDate(date)) {
        setLockError("Tidak dapat mengubah data pada tanggal yang sudah terkunci (hari lalu).");
        return;
      }
    }

    if (action.type === "ADD") {
      const value = (action.payload as { value: unknown }).value;
      switch (field) {
        case "sales": setSales((prev) => [value as DailySale, ...prev]); break;
        case "bakulRecords": setBakulRecords((prev) => [value as BakulRecord, ...prev]); break;
        case "ops": setOps((prev) => [value as OperationalRecord, ...prev]); break;
        case "items": setItems((prev) => [value as ItemMaster, ...prev]); break;
        case "bakulMasters": setBakulMasters((prev) => [value as BakulMaster, ...prev]); break;
        case "stockIn": setStockIn((prev) => [value as StockInRecord, ...prev]); break;
        case "stockOut": setStockOut((prev) => [value as StockOutRecord, ...prev]); break;
        case "priceHistory": setPriceHistory((prev) => [value as PriceHistory, ...prev]); break;
        default: break;
      }
      return;
    }

    if (action.type === "UPDATE") {
      const index = (action.payload as { index: number }).index;
      const value = (action.payload as { value: unknown }).value;
      switch (field) {
        case "sales": setSales((prev) => prev.map((item, i) => (i === index ? value as DailySale : item))); break;
        case "bakulRecords": setBakulRecords((prev) => prev.map((item, i) => (i === index ? value as BakulRecord : item))); break;
        case "ops": setOps((prev) => prev.map((item, i) => (i === index ? value as OperationalRecord : item))); break;
        case "items": setItems((prev) => prev.map((item, i) => (i === index ? value as ItemMaster : item))); break;
        case "bakulMasters": setBakulMasters((prev) => prev.map((item, i) => (i === index ? value as BakulMaster : item))); break;
        case "stockIn": setStockIn((prev) => prev.map((item, i) => (i === index ? value as StockInRecord : item))); break;
        case "stockOut": setStockOut((prev) => prev.map((item, i) => (i === index ? value as StockOutRecord : item))); break;
        case "priceHistory": setPriceHistory((prev) => prev.map((item, i) => (i === index ? value as PriceHistory : item))); break;
        default: break;
      }
      return;
    }

    if (action.type === "DELETE") {
      const index = (action.payload as { index: number }).index;
      switch (field) {
        case "sales": setSales((prev) => prev.filter((_, i) => i !== index)); break;
        case "bakulRecords": setBakulRecords((prev) => prev.filter((_, i) => i !== index)); break;
        case "ops": setOps((prev) => prev.filter((_, i) => i !== index)); break;
        case "items": setItems((prev) => prev.filter((_, i) => i !== index)); break;
        case "bakulMasters": setBakulMasters((prev) => prev.filter((_, i) => i !== index)); break;
        case "stockIn": setStockIn((prev) => prev.filter((_, i) => i !== index)); break;
        case "stockOut": setStockOut((prev) => prev.filter((_, i) => i !== index)); break;
        case "priceHistory": setPriceHistory((prev) => prev.filter((_, i) => i !== index)); break;
        default: break;
      }
      return;
    }
  }, []);

  // Muat ulang data dari server (full reload).
  const reload = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetchAllFromServer().then((serverData) => {
      if (serverData && hasAnyServerData(serverData)) {
        setSales(serverData.sales ?? []);
        setBakulRecords(serverData.bakulRecords ?? []);
        setOps(serverData.ops ?? []);
        setItems(serverData.items ?? []);
        setBakulMasters(serverData.bakulMasters ?? []);
        setStockIn(serverData.stockIn ?? []);
        setStockOut(serverData.stockOut ?? []);
        setPriceHistory(serverData.priceHistory ?? []);
        setOpsCategories(serverData.opsCategories ?? []);
        setSyncStatus("saved");
      } else {
        setLoadError("Gagal memuat data dari server.");
      }
      setDataLoaded(true);
      setLoading(false);
    }).catch(() => {
      setLoadError("Gagal memuat data dari server.");
      setLoading(false);
    });
  }, []);

  // Reset data: admin only, lalu re-seed server dengan data awal.
  const handleResetData = useCallback(async () => {
    setSales(initialSales as DailySale[]);
    setBakulRecords(initialBakulRecords as BakulRecord[]);
    setOps(initialOperationalRecords as OperationalRecord[]);
    setItems(initialItems as ItemMaster[]);
    setBakulMasters(initialBakulMasters as BakulMaster[]);
    setStockIn(initialStockIn as StockInRecord[]);
    setStockOut(initialStockOut as StockOutRecord[]);
    setPriceHistory(initialPriceHistory as PriceHistory[]);
    setOpsCategories(initialOpsCategories as string[]);

    setSyncStatus("saving");
    try {
      const res = await fetch("/api/data", { method: "DELETE" });
      const json = (await res.json()) as { ok?: boolean };
      const resetOk = json.ok === true;
      const success = await pushAllToServer({
        sales: initialSales as DailySale[],
        bakulRecords: initialBakulRecords as BakulRecord[],
        ops: initialOperationalRecords as OperationalRecord[],
        items: initialItems as ItemMaster[],
        bakulMasters: initialBakulMasters as BakulMaster[],
        stockIn: initialStockIn as StockInRecord[],
        stockOut: initialStockOut as StockOutRecord[],
        priceHistory: initialPriceHistory as PriceHistory[],
        opsCategories: initialOpsCategories as string[],
      });
      setSyncStatus(success ? "saved" : resetOk ? "saved" : "error");
    } catch {
      setSyncStatus("error");
    }
  }, []);

  // Helper: apakah sebuah tanggal sudah terkunci (tanggal lampau).
  const isRecordLocked = useCallback(
    (date: string | undefined): boolean => !!date && isLockedDate(date),
    []
  );

  return {
    state,
    dispatch,
    dataLoaded,
    isClient,
    loading,
    loadError,
    lockError,
    syncStatus,
    priceHistory,
    isRecordLocked,
    reload,
    handleResetData,
  };
}
