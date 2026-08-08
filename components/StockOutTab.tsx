"use client";

import {
  Button,
  Card,
  CardBody,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Select,
  SelectItem,
  Tab,
  Tabs,
} from "@heroui/react";
import { AlertCircle, Edit2, Lock, Plus, Printer, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { getActivePrice, rupiah, shortNumber, toNumber } from "@/lib/utils";
import { BakulRecord, ItemMaster, PriceHistory, StockOutRecord } from "@/types/finance";

interface StockOutTabProps {
  stockOut: StockOutRecord[];
  itemNames: string[];
  bakulNames: string[];
  items: ItemMaster[];
  priceHistory: PriceHistory[];
  isRecordLocked: (date: string | undefined) => boolean;
  onAddStockOut: (record: StockOutRecord) => void;
  onUpdateStockOut: (index: number, record: StockOutRecord) => void;
  onDeleteStockOut: (index: number) => void;
  onAddBakul: (record: BakulRecord) => void;
}

const DEFAULT_DATE = new Date().toISOString().slice(0, 10);

let stockOutIdCounter = Date.now();
const nextId = () => `SO-${++stockOutIdCounter}`;

export function StockOutTab({
  stockOut,
  itemNames,
  bakulNames,
  items,
  priceHistory,
  isRecordLocked,
  onAddStockOut,
  onUpdateStockOut,
  onDeleteStockOut,
  onAddBakul,
}: StockOutTabProps) {
  const [search, setSearch] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  const [form, setForm] = useState({
    date: DEFAULT_DATE,
    bakulName: bakulNames[0] || "",
    itemName: itemNames[0] || "",
    quantity: "",
    saleType: "eceran" as "eceran" | "grosir",
    paymentMethod: "cash" as "cash" | "transfer" | "hutang",
    price: "",
  });

  // Auto-calculate price from Master Barang
  const selectedItemMaster = useMemo(
    () => items.find((i) => i.name.toLowerCase() === form.itemName.toLowerCase()),
    [items, form.itemName]
  );

  const autoPrice = selectedItemMaster?.sellPrice || 0;
  const quantityNum = toNumber(form.quantity);
  const priceNum = form.saleType === "grosir" ? toNumber(form.price) : autoPrice;
  const totalAuto = priceNum * quantityNum;

const handleStartEdit = (item: StockOutRecord, originalIndex: number) => {
    setEditingIndex(originalIndex);
    setForm({
      date: item.date,
      bakulName: item.bakulName,
      itemName: item.itemName,
      quantity: String(item.quantity),
      saleType: item.saleType ?? "eceran",
      paymentMethod: item.paymentMethod ?? "cash",
      price: item.saleType === "grosir" ? String(item.price) : "",
    });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setForm({
      date: DEFAULT_DATE,
      bakulName: bakulNames[0] || "",
      itemName: itemNames[0] || "",
      quantity: "",
      saleType: "eceran",
      paymentMethod: "cash",
      price: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bakulName = form.bakulName.trim();
    const itemName = form.itemName.trim();
    const quantity = quantityNum;
    if (!bakulName || !itemName || !quantity) return;
    if (form.saleType === "grosir" && !priceNum) return;

    const isNew = editingIndex === null;

    // Snapshot Harga Transaksi (Price History): cari harga aktif pada tanggal transaksi.
    // effectiveAt <= tanggal transaksi, paling baru. If tidak ada di PriceHistory,
    // gunakan harga master barang.
    const masterItem = items.find(
      (i) => i.name.toLowerCase() === itemName.toLowerCase()
    );
    const activePrice = masterItem
      ? getActivePrice(priceHistory, masterItem.id, form.date)
      : null;
const hargaBeliSnapshot = activePrice ? activePrice.hargaBeli : (masterItem?.buyPrice ?? 0);

    const record: StockOutRecord = {
      id: isNew ? nextId() : stockOut[editingIndex].id,
      date: form.date,
      bakulName,
      itemName,
      quantity,
      price: priceNum,
      buyPriceSnapshot: hargaBeliSnapshot,
      saleType: form.saleType,
      paymentMethod: form.paymentMethod,
    };

if (isNew) {
      onAddStockOut(record);
      // Jika pembayaran hutang, catat langsung ke Piutang Bakul
      if (form.paymentMethod === "hutang") {
        const total = priceNum * quantity;
        onAddBakul({
          date: form.date,
          name: bakulName,
          bill: total,
          paid: 0,
          balance: total,
          note: `Penjualan ${itemName} ${quantity} kg (${rupiah(total)}) - Hutang`,
        });
      }
    } else {
      onUpdateStockOut(editingIndex, record);
    }

    handleCancelEdit();
  };

  const filteredRecords = stockOut
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => {
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      return (
        item.itemName.toLowerCase().includes(query) ||
        item.bakulName.toLowerCase().includes(query) ||
        item.date.includes(query)
      );
    });

  // Calculate total stock out per item
  const stockOutTotals = stockOut.reduce((acc, item) => {
    const key = item.itemName.toLowerCase();
    acc[key] = (acc[key] || 0) + item.quantity;
    return acc;
  }, {} as Record<string, number>);

const saleTypeLabel = (type?: "eceran" | "grosir") => type ?? "eceran";

  const handlePrintReceipt = (record: StockOutRecord) => {
    const total = record.quantity * record.price;
    const method = record.paymentMethod ?? "cash";
    const methodLabel =
      method === "cash" ? "Cash" : method === "transfer" ? "Transfer" : "Hutang";
    const saleType = record.saleType ?? "eceran";

    const win = window.open("", "_blank", "width=320,height=640");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Struk Penjualan</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { width: 280px; margin: 0 auto; padding: 12px; font-family: 'Courier New', monospace; color: #000; font-size: 12px; }
            .center { text-align: center; }
            .title { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
            .sub { font-size: 10px; margin-bottom: 6px; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
            .b { font-weight: bold; }
            .total { font-size: 14px; font-weight: bold; margin-top: 4px; }
            .footer { text-align: center; font-size: 10px; margin-top: 10px; }
            @media print { body { width: 80mm; } }
          </style>
        </head>
        <body>
          <div class="center">
            <div class="title">BUKU KEUANGAN TELUR</div>
            <div class="sub">Data Penjualan Telur</div>
          </div>
          <div class="divider"></div>
          <div class="row"><span>No. Struk</span><span class="b">${record.id}</span></div>
          <div class="row"><span>Tanggal</span><span>${record.date}</span></div>
          <div class="row"><span>Pelanggan</span><span class="b">${record.bakulName}</span></div>
          <div class="row"><span>Jenis</span><span>${saleType === "grosir" ? "Grosir" : "Eceran"}</span></div>
          <div class="row"><span>Pembayaran</span><span>${methodLabel}</span></div>
          <div class="divider"></div>
          <div class="row"><span>${record.itemName}</span></div>
          <div class="row"><span>&nbsp;&nbsp;${record.quantity} kg x ${rupiah(record.price)}</span><span>${rupiah(total)}</span></div>
          <div class="divider"></div>
          <div class="row total"><span>TOTAL</span><span>${rupiah(total)}</span></div>
          <div class="divider"></div>
          <div class="footer">
            Terima kasih<br />
            Barang yang sudah dibeli tidak dapat dikembalikan.
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
      {/* Form Panel */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-black text-[#191712]">
          {editingIndex === null ? "Input Barang Keluar / Penjualan" : "Edit Barang Keluar / Penjualan"}
        </h2>
        <p className="text-xs text-[#706858] mt-1 mb-4">
          Catat penjualan barang ke pelanggan. Pilih Eceran (harga otomatis) atau Grosir (harga manual).
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="date"
            label="Tanggal Keluar"
            labelPlacement="outside"
            value={form.date}
            onValueChange={(date) => setForm((prev) => ({ ...prev, date }))}
            radius="sm"
            required
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#191712]">Nama Bakul / Pelanggan</label>
            <Select
              aria-label="Pilih Nama Bakul"
              selectedKeys={form.bakulName ? [form.bakulName] : []}
              onSelectionChange={(keys) => {
                const selected = String(Array.from(keys)[0] ?? form.bakulName);
                setForm((prev) => ({ ...prev, bakulName: selected }));
              }}
              radius="sm"
              isDisabled={bakulNames.length === 0}
            >
              {bakulNames.map((name) => (
                <SelectItem key={name}>{name}</SelectItem>
              ))}
            </Select>
            {bakulNames.length === 0 && (
              <p className="text-[11px] text-amber-700 font-medium mt-1">
                ⚠️ Belum ada data pelanggan. Buat di menu Master & Cadangan.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#191712]">Nama Barang</label>
            <Select
              aria-label="Pilih Nama Barang"
              selectedKeys={form.itemName ? [form.itemName] : []}
              onSelectionChange={(keys) => {
                const selected = String(Array.from(keys)[0] ?? form.itemName);
                setForm((prev) => ({ ...prev, itemName: selected }));
              }}
              radius="sm"
              isDisabled={itemNames.length === 0}
            >
              {itemNames.map((name) => (
                <SelectItem key={name}>{name}</SelectItem>
              ))}
            </Select>
            {itemNames.length === 0 && (
              <p className="text-[11px] text-amber-700 font-medium mt-1">
                ⚠️ Belum ada data barang. Buat di menu Master & Cadangan.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#191712]">Stok Keluar (kg)</label>
            <Input
              labelPlacement="outside"
              placeholder="cth. 1.5"
              value={form.quantity}
              onValueChange={(quantity) => setForm((prev) => ({ ...prev, quantity }))}
              radius="sm"
              required
              endContent={<span className="text-xs font-bold text-[#706858]">kg</span>}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#191712]">Jenis Penjualan</label>
            <Tabs
              aria-label="Jenis Penjualan"
              selectedKey={form.saleType}
              onSelectionChange={(key) =>
                setForm((prev) => ({ ...prev, saleType: String(key) as "eceran" | "grosir", price: "" }))
              }
              radius="sm"
              variant="bordered"
              classNames={{
                tabList: "w-full",
                tab: "flex-1",
              }}
            >
<Tab key="eceran" title="Eceran" />
              <Tab key="grosir" title="Grosir" />
            </Tabs>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#191712]">Metode Pembayaran</label>
            <Tabs
              aria-label="Metode Pembayaran"
              selectedKey={form.paymentMethod}
              onSelectionChange={(key) =>
                setForm((prev) => ({ ...prev, paymentMethod: String(key) as "cash" | "transfer" | "hutang" }))
              }
              radius="sm"
              variant="bordered"
              classNames={{
                tabList: "w-full",
                tab: "flex-1",
              }}
            >
              <Tab key="cash" title="Cash" />
              <Tab key="transfer" title="Transfer" />
              <Tab key="hutang" title="Hutang" />
            </Tabs>
            {form.paymentMethod === "hutang" && (
              <p className="text-[11px] text-amber-700 font-medium mt-1">
                ⚠️ Penjualan hutang akan otomatis dicatat ke menu <strong>Piutang Bakul</strong>.
              </p>
            )}
          </div>

          {form.saleType === "grosir" ? (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#191712]">Harga Grosir (Rp/kg)</label>
              <Input
                labelPlacement="outside"
                placeholder="cth. 27000"
                value={form.price}
                onValueChange={(price) => setForm((prev) => ({ ...prev, price }))}
                radius="sm"
                required
                startContent={<span className="text-xs font-bold text-[#706858]">Rp</span>}
              />
            </div>
          ) : (
            <div className="rounded-xl bg-[#f7f5ef] p-3 border border-[#191712]/5 text-xs">
              <span className="font-bold text-[#706858]">Harga Eceran / kg (Otomatis dari Master Barang)</span>
              <div className="mt-1 font-mono font-black text-[#191712]">{rupiah(autoPrice)}</div>
            </div>
          )}

          {/* Auto Price Preview */}
          <div className="rounded-xl bg-[#f7f5ef] p-4 border border-[#191712]/5 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-[#706858]">
                Harga Jual / kg ({form.saleType === "grosir" ? "Manual" : "Otomatis"})
              </span>
              <span className="font-mono font-black text-[#191712]">{rupiah(priceNum)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="font-bold text-[#706858]">Total Penjualan</span>
              <span className="font-mono font-black text-[#1f8f5f]">{rupiah(totalAuto)}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              className="flex-1 bg-[#191712] font-bold text-white shadow-sm"
              radius="sm"
              startContent={editingIndex === null ? <Plus size={16} /> : <Edit2 size={16} />}
            >
              {editingIndex === null ? "Simpan Penjualan" : "Simpan Perubahan"}
            </Button>
            {editingIndex !== null && (
              <Button variant="flat" onPress={handleCancelEdit} radius="sm">
                Batal
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Data List Panel */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-black text-[#191712]">Riwayat Barang Keluar</h2>
          <div className="w-full sm:w-64">
            <Input
              size="sm"
              placeholder="Cari barang/bakul/tanggal..."
              value={search}
              onValueChange={setSearch}
              startContent={<Search size={14} className="text-[#706858]" />}
              radius="sm"
              isClearable
              onClear={() => setSearch("")}
            />
          </div>
        </div>

        {/* Stock Out Totals Summary */}
        <div className="rounded-xl bg-[#f7f5ef] p-4 border border-[#191712]/5">
          <h3 className="text-xs font-bold text-[#706858] uppercase mb-2">Total Barang Keluar</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stockOutTotals).map(([key, qty]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold border border-[#191712]/10"
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}: {shortNumber(qty)} kg
              </span>
            ))}
            {Object.keys(stockOutTotals).length === 0 && (
              <span className="text-xs text-[#706858]">Belum ada penjualan tercatat.</span>
            )}
          </div>
        </div>

        <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
          {filteredRecords.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#706858]">
              Tidak ditemukan catatan barang keluar.
            </div>
          ) : (
            filteredRecords.map(({ item, originalIndex }) => {
              const locked = isRecordLocked(item.date);
              return (
              <Card
                key={item.id}
                shadow="none"
                radius="sm"
                className="border border-[#191712]/10 bg-white transition-all hover:border-[#191712]/30"
              >
                <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-black text-[#191712]">{item.itemName}</h3>
                    <p className="text-xs text-[#706858] font-medium">
                      {item.date} • {item.bakulName}
                    </p>
                    {locked && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#f0eadb] px-2 py-0.5 mt-1 text-[10px] font-bold text-[#706858]">
                        <Lock size={10} /> Terkunci
                      </span>
                    )}
<div className="mt-1 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          saleTypeLabel(item.saleType) === "grosir"
                            ? "bg-[#fff3cd] text-[#8f6b00]"
                            : "bg-[#e7f5ec] text-[#1f8f5f]"
                        }`}
                      >
                        {saleTypeLabel(item.saleType)}
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
                      <span className="text-[10px] text-[#706858] font-medium">
                        Harga jual: {rupiah(item.price)} / kg
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 justify-between sm:justify-end">
                    <div className="text-right">
                      <span className="font-mono font-black text-[#e05234]">-{shortNumber(item.quantity)} kg</span>
                      <p className="text-[10px] text-[#706858] font-mono font-bold">{rupiah(item.price * item.quantity)}</p>
                    </div>
<div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="flat"
                        className="bg-[#e6f1ff] font-bold text-[#173a61] min-w-unit-12"
                        startContent={<Printer size={14} />}
                        onPress={() => handlePrintReceipt(item)}
                        radius="sm"
                      >
                        Struk
                      </Button>
                      {!locked && (
                        <>
                      <Button
                        size="sm"
                        variant="flat"
                        className="font-bold min-w-unit-12"
                        onPress={() => handleStartEdit(item, originalIndex)}
                        radius="sm"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="flat"
                        className="bg-[#ffe2d8] font-bold text-[#8f321a] min-w-unit-12"
                        onPress={() => setDeleteConfirmIndex(originalIndex)}
                        radius="sm"
                      >
                        Hapus
                      </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteConfirmIndex !== null} onClose={() => setDeleteConfirmIndex(null)} size="sm">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 text-rose-700">
            <AlertCircle size={20} />
            <span>Hapus Catatan Barang Keluar?</span>
          </ModalHeader>
          <ModalBody className="pb-6">
            <p className="text-sm text-slate-700">
              Apakah Anda yakin ingin menghapus data penjualan untuk{" "}
              <strong>{deleteConfirmIndex !== null ? stockOut[deleteConfirmIndex]?.itemName : ""}</strong>?
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="flat" radius="sm" onPress={() => setDeleteConfirmIndex(null)}>
                Batal
              </Button>
              <Button
                className="bg-rose-600 font-bold text-white"
                radius="sm"
                onPress={() => {
                  if (deleteConfirmIndex !== null) {
                    onDeleteStockOut(deleteConfirmIndex);
                    setDeleteConfirmIndex(null);
                  }
                }}
              >
                Hapus Data
              </Button>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
