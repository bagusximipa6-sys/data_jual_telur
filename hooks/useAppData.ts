"use client";

import { useReducer, useEffect, useState, useSyncExternalStore } from "react";
import type {
  DailySale,
  BakulRecord,
  OperationalRecord,
  ItemMaster,
  BakulMaster,
  StockInRecord,
  StockOutRecord,
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
} from "@/app/rpa-data";
import { useAuth } from "@/hooks/useAuth";

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

type Action = {
  [Key in keyof ActionMap]: {
    type: Key;
    payload: ActionMap[Key];
  };
}[keyof ActionMap];

const initialState: AppDataSet = {
  sales: initialSales as DailySale[],
  bakulRecords: initialBakulRecords as BakulRecord[],
  ops: initialOperationalRecords as OperationalRecord[],
  items: initialItems as ItemMaster[],
  bakulMasters: initialBakulMasters as BakulMaster[],
  stockIn: initialStockIn as StockInRecord[],
  stockOut: initialStockOut as StockOutRecord[],
  opsCategories: initialOpsCategories as string[],
};

function dataReducer(state: AppDataSet, action: Action): AppDataSet {
  switch (action.type) {
    case "SET_ALL_DATA":
      return action.payload ?? initialState;
    case "SET_FIELD":
      return { ...state, [action.payload.field]: action.payload.value };
    case "ADD":
      return { ...state, [action.payload.field]: [action.payload.value, ...(state[action.payload.field] as any[])] };
    case "UPDATE": {
      const list = [...(state[action.payload.field] as any[])];
      list[action.payload.index] = action.payload.value;
      return { ...state, [action.payload.field]: list };
    }
    case "DELETE": {
      const list = (state[action.payload.field] as any[]).filter((_, i) => i !== action.payload.index);
      return { ...state, [action.payload.field]: list };
    }
    case "RESET_DATA":
      return initialState;
    default:
      return state;
  }
}

async function loadFromApi(fallback: AppDataSet): Promise<AppDataSet> {
  try {
    const res = await fetch("/api/data", { cache: "no-store" });
    if (!res.ok) throw new Error(`GET /api/data gagal: ${res.status}`);
    const json = (await res.json()) as { ok: boolean; data?: AppDataSet };
    if (!json.ok || !json.data) throw new Error("Respons /api/data tidak valid.");
    return json.data;
  } catch (err) {
    console.error("Gagal memuat data dari backend:", err);
    return fallback;
  }
}

function subscribeToClient() {
  return () => {};
}

export function useAppData() {
  const isClient = useSyncExternalStore(subscribeToClient, () => true, () => false);
  const { adminUnlocked } = useAuth();
  const [state, dispatch] = useReducer(dataReducer, initialState);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const reload = () => {
    setLoading(true);
    setLoadError(null);
    loadFromApi(initialState).then((data) => {
      dispatch({ type: "SET_ALL_DATA", payload: data });
      setDataLoaded(true);
      setLoading(false);
    }).catch(() => {
      setLoadError("Gagal memuat data dari server.");
      setLoading(false);
    });
  };

  // Load data from API on initial client-side render
  useEffect(() => {
    if (!isClient || dataLoaded) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, dataLoaded]);

  // Save data to API on change, with debounce (hanya jika admin)
  useEffect(() => {
    if (!isClient || !dataLoaded || !adminUnlocked) return;
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state),
        });
        if (!res.ok) {
          throw new Error(`POST /api/data gagal: ${res.status}`);
        }
        setSaveStatus("saved");
      } catch (err) {
        console.error("Gagal menyimpan data ke backend:", err);
        setSaveStatus("error");
      }
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, dataLoaded, adminUnlocked, state]);

  // Reset data: admin only
  const handleResetData = async () => {
    if (!adminUnlocked) return;
dispatch({ type: "RESET_DATA", payload: undefined });
    try {
      const res = await fetch("/api/data", { method: "DELETE" });
      if (!res.ok) {
        throw new Error(`DELETE /api/data gagal: ${res.status}`);
      }
    } catch (err) {
      console.error("Gagal mereset data di backend:", err);
    }
  };

  return {
    state,
    dispatch,
    dataLoaded,
    isClient,
    loading,
    loadError,
    saveStatus,
    reload,
    handleResetData,
  };
}
