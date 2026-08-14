"use client";

import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@heroui/react";
import { AlertTriangle, Boxes, Download, History, LockKeyhole, MapPin, Plus, RefreshCw, Trash2, Upload, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import { exportToJSON, rupiah, todayISO, toNumber } from "@/lib/utils";
import {
  BakulMaster,
  BakulRecord,
  DailySale,
  ItemMaster,
  OperationalRecord,
  PriceHistory,
  Role,
  StockInRecord,
  StockOutRecord,
} from "@/types/finance";

interface MasterTabProps {
  categories: string[];
  sales: DailySale[];
  bakulRecords: BakulRecord[];
  ops: OperationalRecord[];
  items: ItemMaster[];
  bakulMasters: BakulMaster[];
  stockIn: StockInRecord[];
  stockOut: StockOutRecord[];
  priceHistory: PriceHistory[];
  opsCategories: string[];
  role: Role;
  onAddItem: (item: ItemMaster) => void;
  onUpdateItem: (index: number, item: ItemMaster) => void;
  onDeleteItem: (index: number) => void;
  onAddPriceHistory: (record: PriceHistory) => void;
  onAddBakulMaster: (master: BakulMaster) => void;
  onUpdateBakulMaster: (index: number, master: BakulMaster) => void;
  onDeleteBakulMaster: (index: number) => void;
  onAddOpsCategory: (category: string) => void;
  onDeleteOpsCategory: (category: string) => void;
  onImportData: (data: {
    sales: DailySale[];
    bakulRecords: BakulRecord[];
    ops: OperationalRecord[];
    items?: ItemMaster[];
    bakulMasters?: BakulMaster[];
    stockIn?: StockInRecord[];
    stockOut?: StockOutRecord[];
    priceHistory?: PriceHistory[];
    opsCategories?: string[];
  }) => void;
  onResetData: () => void;
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function MasterTab({
  sales,
  bakulRecords,
  ops,
  items,
  bakulMasters,
  stockIn,
  stockOut,
  priceHistory,
  opsCategories,
  role,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onAddPriceHistory,
  onAddBakulMaster,
  onUpdateBakulMaster,
  onDeleteBakulMaster,
  onAddOpsCategory,
  onDeleteOpsCategory,
  onImportData,
  onResetData,
}: MasterTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importError, setImportError] = useState("");
  const isAdmin = role === "admin";

  // === Form State: Master Barang ===
const [itemForm, setItemForm] = useState({ name: "", sellPrice: "" });
  const [itemEditIndex, setItemEditIndex] = useState<number | null>(null);
  const [itemDeleteIndex, setItemDeleteIndex] = useState<number | null>(null);

  const resetItemForm = () => {
    setItemForm({ name: "", sellPrice: "" });
    setItemEditIndex(null);
  };

  const handleSubmitItem = (e: React.FormEvent) => {
    e.preventDefault();
    const name = itemForm.name.trim();
    const sellPrice = toNumber(itemForm.sellPrice);
    const buyPrice = 0; // Harga beli tidak lagi di-set dari form ini
    if (!name || sellPrice <= 0) return;

    const record: ItemMaster = { id: uid(), name, sellPrice, buyPrice };
    if (itemEditIndex !== null) {
      onUpdateItem(itemEditIndex, record);
    } else {
      onAddItem(record);
    }
    // Catat entri PriceHistory baru (append-only) — tidak UPDATE harga lama.
    onAddPriceHistory({
      id: uid(),
      barangId: record.id,
      hargaBeli: buyPrice,
      hargaJual: sellPrice,
      effectiveAt: todayISO(),
    });
    resetItemForm();
  };

  const handleStartEditItem = (item: ItemMaster, index: number) => {
    setItemEditIndex(index);
    setItemForm({
      name: item.name,
      sellPrice: String(item.sellPrice),
    });
  };

  // === Form State: Master Pelanggan / Bakul ===
  const [bakulForm, setBakulForm] = useState({ name: "", address: "" });
  const [bakulEditIndex, setBakulEditIndex] = useState<number | null>(null);
  const [bakulDeleteIndex, setBakulDeleteIndex] = useState<number | null>(null);

  const resetBakulForm = () => {
    setBakulForm({ name: "", address: "" });
    setBakulEditIndex(null);
  };

  const handleSubmitBakul = (e: React.FormEvent) => {
    e.preventDefault();
    const name = bakulForm.name.trim();
    if (!name) return;

    const record: BakulMaster = { id: uid(), name, address: bakulForm.address.trim() };
    if (bakulEditIndex !== null) {
      onUpdateBakulMaster(bakulEditIndex, record);
    } else {
      onAddBakulMaster(record);
    }
    resetBakulForm();
  };

  const handleStartEditBakul = (master: BakulMaster, index: number) => {
    setBakulEditIndex(index);
    setBakulForm({ name: master.name, address: master.address });
  };

// === Backup / Restore ===
  const handleExportJSON = () => {
    exportToJSON(sales, bakulRecords, ops, items, bakulMasters, stockIn, stockOut, opsCategories, priceHistory);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && Array.isArray(json.sales) && Array.isArray(json.bakulRecords) && Array.isArray(json.ops)) {
          onImportData({
            sales: json.sales,
            bakulRecords: json.bakulRecords,
            ops: json.ops,
            items: Array.isArray(json.items) ? json.items : [],
            bakulMasters: Array.isArray(json.bakulMasters) ? json.bakulMasters : [],
            stockIn: Array.isArray(json.stockIn) ? json.stockIn : [],
            stockOut: Array.isArray(json.stockOut) ? json.stockOut : [],
            priceHistory: Array.isArray(json.priceHistory) ? json.priceHistory : [],
            opsCategories: Array.isArray(json.opsCategories) ? json.opsCategories : [],
          });
          setImportError("");
          alert("Data berhasil di-import!");
        } else {
          setImportError("Format file JSON tidak sesuai dengan skema Buku Keuangan.");
        }
      } catch {
        setImportError("File tidak valid atau rusak.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Master Barang & Harga (Owner) */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-[#191712]">Master Barang & Harga</h2>
<p className="text-xs text-[#706858]">
              Daftar nama barang beserta Harga Jual. Khusus Owner (Admin). Harga Beli dicatat di menu Barang Masuk.
            </p>
          </div>
          <Chip size="sm" className="bg-[#e6f1ff] font-bold text-[#173a61]">
            {items.length} Barang
          </Chip>
        </div>

        {isAdmin ? (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            {/* Form Barang */}
            <form onSubmit={handleSubmitItem} className="space-y-4 rounded-xl border border-[#191712]/10 bg-[#f7f5ef] p-4">
              <h3 className="font-black text-sm text-[#191712]">
                {itemEditIndex === null ? "Tambah Barang Baru" : "Edit Barang"}
              </h3>
<Input
                label="Nama Barang"
                labelPlacement="outside"
                placeholder="cth. Telur Ayam"
                value={itemForm.name}
                onValueChange={(name) => setItemForm((prev) => ({ ...prev, name }))}
                radius="sm"
                required
              />
              <Input
                label="Harga Jual /kg (Rp)"
                labelPlacement="outside"
                placeholder="cth. 23000"
                value={itemForm.sellPrice}
                onValueChange={(sellPrice) => setItemForm((prev) => ({ ...prev, sellPrice }))}
                radius="sm"
                required
              />

              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1 bg-[#191712] font-bold text-white shadow-sm"
                  radius="sm"
                  startContent={itemEditIndex === null ? <Plus size={16} /> : <RefreshCw size={16} />}
                >
                  {itemEditIndex === null ? "Simpan Barang" : "Simpan Perubahan"}
                </Button>
                {itemEditIndex !== null && (
                  <Button variant="flat" onPress={resetItemForm} radius="sm">
                    Batal
                  </Button>
                )}
              </div>
            </form>

            {/* List Barang */}
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {items.length === 0 ? (
                <div className="py-12 text-center text-sm text-[#706858]">
                  <Boxes size={28} className="mx-auto mb-2 opacity-40" />
                  Belum ada barang terdaftar.
                </div>
              ) : (
items.map((item, index) => {
                  return (
                    <Card key={item.id} shadow="none" radius="sm" className="border border-[#191712]/10 bg-white">
                      <CardBody className="gap-2 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-black text-[#191712]">{item.name}</h3>
                            <p className="text-[10px] text-[#706858] uppercase font-bold">Master Barang</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-xs">
                          <div className="rounded-lg bg-[#f7f5ef] p-2">
                            <span className="text-[10px] text-[#706858] uppercase block">Harga Jual /kg</span>
                            <span className="font-bold text-[#1f8f5f]">{rupiah(item.sellPrice)}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1 border-t border-[#191712]/5">
                          <Button
                            size="sm"
                            variant="flat"
                            className="font-bold"
                            onPress={() => handleStartEditItem(item, index)}
                            radius="sm"
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="flat"
                            className="bg-[#ffe2d8] font-bold text-[#8f321a]"
                            startContent={<Trash2 size={14} />}
                            onPress={() => setItemDeleteIndex(index)}
                            radius="sm"
                          >
                            Hapus
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900">
            🔒 <strong>Master Barang & Harga</strong> hanya dapat diubah dalam Mode Admin (Owner).
          </div>
        )}

{/* Riwayat Harga (Price History) — Hanya Admin (Owner) */}
        <div className="rounded-xl border border-[#191712]/10 bg-[#f7f5ef] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <History size={16} className="text-[#706858]" />
            <h3 className="font-black text-sm text-[#191712]">Riwayat Harga Berbasis Tanggal (Price History)</h3>
          </div>

          {isAdmin ? (
            <>
              <p className="text-[11px] text-[#706858]">
                Setiap kali harga barang diubah, entri baru dicatat (append-only). Harga lama tidak ditimpa, sehingga
                laporan keuangan hari-hari sebelumnya tidak berubah.
              </p>
              {priceHistory.length === 0 ? (
                <p className="text-xs text-[#706858]">
                  Belum ada riwayat harga. Simpan barang beserta harga untuk mencatat entri pertama.
                </p>
              ) : (
                <div className="max-h-[240px] space-y-2 overflow-y-auto pr-1">
                  {priceHistory
                    .slice()
                    .sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt))
                    .map((p) => {
                      const item = items.find((i) => i.id === p.barangId);
                      return (
                        <div
                          key={p.id}
                          className="rounded-lg bg-white border border-[#191712]/10 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-[#191712]">{item?.name ?? "(barang terhapus)"}</span>
                            <span className="font-mono text-[10px] font-bold text-[#706858]">{p.effectiveAt}</span>
                          </div>
                          <div className="text-[#706858] font-medium mt-0.5">
                            Harga Jual <span className="text-[#1f8f5f] font-bold">{rupiah(p.hargaJual)}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          ) : (
            <div className="relative overflow-hidden rounded-xl border border-[#191712]/10 bg-white">
              <div
                className="pointer-events-none select-none blur-[6px] opacity-60"
                aria-hidden="true"
              >
                <div className="max-h-[150px] space-y-2 overflow-hidden p-3">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg bg-[#f0eadb] border border-[#191712]/10 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-[#191712]">Telur Ayam</span>
                        <span className="font-mono text-[10px] font-bold text-[#706858]">2024-01-01</span>
                      </div>
                      <div className="text-[#706858] font-medium mt-0.5">
                        Beli <span className="text-[#8f321a] font-bold">Rp xx.xxx</span>
                        {" • "}Jual <span className="text-[#1f8f5f] font-bold">Rp xx.xxx</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/40 p-4 text-center">
                <LockKeyhole size={22} className="text-[#8f321a]" />
                <p className="rounded-lg bg-[#ffe2d8] px-3 py-2 text-xs font-bold text-[#8f321a]">
                  🔒 Riwayat harga hanya dapat dilihat oleh Admin (Owner).
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Master Pelanggan / Bakul (User & Owner) */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-[#191712]">Master Pelanggan / Bakul</h2>
            <p className="text-xs text-[#706858]">
              Daftar nama bakul dan alamat. Dapat diisi oleh User & Owner.
            </p>
          </div>
          <Chip size="sm" className="bg-[#f0eadb] font-bold text-[#191712]">
            {bakulMasters.length} Pelanggan
          </Chip>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Form Pelanggan */}
          <form onSubmit={handleSubmitBakul} className="space-y-4 rounded-xl border border-[#191712]/10 bg-[#f7f5ef] p-4">
            <h3 className="font-black text-sm text-[#191712]">
              {bakulEditIndex === null ? "Tambah Bakul / Pelanggan" : "Edit Bakul / Pelanggan"}
            </h3>
            <Input
              label="Nama Bakul"
              labelPlacement="outside"
              placeholder="cth. Saeful"
              value={bakulForm.name}
              onValueChange={(name) => setBakulForm((prev) => ({ ...prev, name }))}
              radius="sm"
              required
            />
            <Input
              label="Alamat"
              labelPlacement="outside"
              placeholder="cth. Demak"
              value={bakulForm.address}
              onValueChange={(address) => setBakulForm((prev) => ({ ...prev, address }))}
              radius="sm"
              startContent={<MapPin size={14} className="text-[#706858]" />}
            />

            <div className="flex gap-2">
              <Button
                type="submit"
                className="flex-1 bg-[#191712] font-bold text-white shadow-sm"
                radius="sm"
                startContent={bakulEditIndex === null ? <Plus size={16} /> : <RefreshCw size={16} />}
              >
                {bakulEditIndex === null ? "Simpan Bakul" : "Simpan Perubahan"}
              </Button>
              {bakulEditIndex !== null && (
                <Button variant="flat" onPress={resetBakulForm} radius="sm">
                  Batal
                </Button>
              )}
            </div>
          </form>

          {/* List Pelanggan */}
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {bakulMasters.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#706858]">
                <UserRound size={28} className="mx-auto mb-2 opacity-40" />
                Belum ada pelanggan / bakul terdaftar.
              </div>
            ) : (
              bakulMasters.map((master, index) => (
                <Card key={master.id} shadow="none" radius="sm" className="border border-[#191712]/10 bg-white">
                  <CardBody className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-black text-[#191712]">{master.name}</h3>
                      <p className="text-xs text-[#706858] flex items-center gap-1">
                        <MapPin size={12} />
                        {master.address || "Alamat belum diisi"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="flat"
                        className="font-bold"
                        onPress={() => handleStartEditBakul(master, index)}
                        radius="sm"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="flat"
                        className="bg-[#ffe2d8] font-bold text-[#8f321a]"
                        startContent={<Trash2 size={14} />}
                        onPress={() => setBakulDeleteIndex(index)}
                        radius="sm"
                      >
                        Hapus
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

{/* Kategori Operasional */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-[#191712]">Kategori Operasional</h2>
            <p className="text-xs text-[#706858]">
              Daftar kategori biaya operasional sebagai master data. Dapat dikelola oleh Admin.
            </p>
          </div>
          <Chip size="sm" className="bg-[#e6f1ff] font-bold text-[#173a61]">
            {opsCategories.length} Kategori
          </Chip>
        </div>

        {isAdmin ? (
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            {/* Form tambah kategori */}
            <NewOpsCategoryForm onAdd={onAddOpsCategory} />
            {/* Daftar kategori */}
            <div className="flex flex-wrap gap-2 content-start">
              {opsCategories.length === 0 ? (
                <p className="text-sm text-[#706858]">Belum ada kategori operasional.</p>
              ) : (
                opsCategories.map((category) => (
                  <Chip
                    key={category}
                    className="bg-[#f0eadb] font-bold text-[#191712] capitalize"
                    size="md"
                    onClose={() => onDeleteOpsCategory(category)}
                  >
                    🏷️ {category}
                  </Chip>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-2">
            {opsCategories.length === 0 ? (
              <p className="text-sm text-[#706858]">Belum ada kategori operasional.</p>
            ) : (
              opsCategories.map((category) => (
                <Chip key={category} className="bg-[#f0eadb] font-bold text-[#191712] capitalize" size="md">
                  🏷️ {category}
                </Chip>
              ))
            )}
          </div>
        )}
      </div>

      {/* Backup & Restore */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6 space-y-4">
        <div>
          <h2 className="text-xl font-black text-[#191712]">Cadangan & Pemulihan Data (Backup / Restore)</h2>
          <p className="text-xs text-[#706858]">
            Simpan data keuangan ke file cadangan JSON atau pulihkan data dari file JSON.
          </p>
        </div>

        {importError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-medium">
            ⚠️ {importError}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Button
            className="bg-[#191712] font-bold text-white shadow-sm"
            startContent={<Download size={16} />}
            onPress={handleExportJSON}
          >
            Download Backup JSON
          </Button>

          {isAdmin && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".json"
                onChange={handleFileChange}
              />
              <Button
                variant="flat"
                className="bg-[#e6f1ff] font-bold text-[#173a61]"
                startContent={<Upload size={16} />}
                onPress={() => fileInputRef.current?.click()}
              >
                Import Data JSON
              </Button>

              <Button
                variant="flat"
                className="bg-[#ffe2d8] font-bold text-[#8f321a]"
                startContent={<RefreshCw size={16} />}
                onPress={() => setShowResetConfirm(true)}
              >
                Reset ke Data Awal Demo
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Item */}
      <Modal isOpen={itemDeleteIndex !== null} onClose={() => setItemDeleteIndex(null)} size="sm">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 text-rose-700">
            <AlertTriangle size={20} />
            <span>Hapus Barang?</span>
          </ModalHeader>
          <ModalBody className="pb-6">
            <p className="text-sm text-slate-700">
              Apakah Anda yakin ingin menghapus barang{" "}
              <strong>{itemDeleteIndex !== null ? items[itemDeleteIndex]?.name : ""}</strong>?
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="flat" radius="sm" onPress={() => setItemDeleteIndex(null)}>
                Batal
              </Button>
              <Button
                className="bg-rose-600 font-bold text-white"
                radius="sm"
                onPress={() => {
                  if (itemDeleteIndex !== null) {
                    onDeleteItem(itemDeleteIndex);
                    setItemDeleteIndex(null);
                  }
                }}
              >
                Hapus Data
              </Button>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Bakul Master */}
      <Modal isOpen={bakulDeleteIndex !== null} onClose={() => setBakulDeleteIndex(null)} size="sm">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 text-rose-700">
            <AlertTriangle size={20} />
            <span>Hapus Pelanggan / Bakul?</span>
          </ModalHeader>
          <ModalBody className="pb-6">
            <p className="text-sm text-slate-700">
              Apakah Anda yakin ingin menghapus pelanggan{" "}
              <strong>{bakulDeleteIndex !== null ? bakulMasters[bakulDeleteIndex]?.name : ""}</strong>?
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="flat" radius="sm" onPress={() => setBakulDeleteIndex(null)}>
                Batal
              </Button>
              <Button
                className="bg-rose-600 font-bold text-white"
                radius="sm"
                onPress={() => {
                  if (bakulDeleteIndex !== null) {
                    onDeleteBakulMaster(bakulDeleteIndex);
                    setBakulDeleteIndex(null);
                  }
                }}
              >
                Hapus Data
              </Button>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} size="sm">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 text-rose-700">
            <AlertTriangle size={20} />
            <span>Reset Seluruh Data Keuangan?</span>
          </ModalHeader>
          <ModalBody className="pb-6">
            <p className="text-sm text-slate-700">
              Apakah Anda yakin ingin mengembalikan seluruh data rekap penjualan, bakul, operasional, master barang,
              dan master pelanggan ke kondisi awal kosong?
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="flat" radius="sm" onPress={() => setShowResetConfirm(false)}>
                Batal
              </Button>
              <Button
                className="bg-rose-600 font-bold text-white"
                radius="sm"
                onPress={() => {
                  onResetData();
                  setShowResetConfirm(false);
                }}
              >
                Reset Data Demo
              </Button>
            </div>
          </ModalBody>
        </ModalContent>
</Modal>
    </div>
  );
}

function NewOpsCategoryForm({ onAdd }: { onAdd: (category: string) => void }) {
  const [value, setValue] = useState("");
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue(""); // Reset input value after adding
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-[#191712]/10 bg-[#f7f5ef] p-4">
      <h3 className="font-black text-sm text-[#191712]">Tambah Kategori Operasional</h3>
      <div className="flex gap-2">
        <Input
          label="Nama Kategori"
          labelPlacement="outside"
          placeholder="cth. Bensin + Parkir"
          value={value}
          onValueChange={setValue}
          radius="sm"
          required
        />
        <Button type="submit" className="mt-6 bg-[#191712] font-bold text-white shadow-sm" radius="sm">
          <Plus size={16} /> Tambah
        </Button>
      </div>
    </form>
  );
}
