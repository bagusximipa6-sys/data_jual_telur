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
} from "@heroui/react";
import { AlertCircle, Edit2, Lock, Plus, Search } from "lucide-react";
import { useState } from "react";
import { rupiah, shortNumber, toNumber } from "@/lib/utils";
import { Role, StockInRecord } from "@/types/finance";

interface StockInTabProps {
  stockIn: StockInRecord[];
  itemNames: string[];
  role: Role;
  onAddStockIn: (record: StockInRecord) => void;
  onUpdateStockIn: (index: number, record: StockInRecord) => void;
  onDeleteStockIn: (index: number) => void;
}

const DEFAULT_DATE = new Date().toISOString().slice(0, 10);

let stockInIdCounter = Date.now();
const nextId = () => `SI-${++stockInIdCounter}`;

export function StockInTab({
  stockIn,
  itemNames,
  role,
  onAddStockIn,
  onUpdateStockIn,
  onDeleteStockIn,
}: StockInTabProps) {
  const [search, setSearch] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

const [form, setForm] = useState({
    date: DEFAULT_DATE,
    itemName: itemNames[0] || "",
    quantity: "",
    buyPrice: "",
  });

  const isAdmin = role === "admin";

  const handleStartEdit = (item: StockInRecord, originalIndex: number) => {
    setEditingIndex(originalIndex);
    setForm({
      date: item.date,
      itemName: item.itemName,
      quantity: String(item.quantity),
      buyPrice: String(item.buyPrice),
    });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setForm({
      date: DEFAULT_DATE,
      itemName: itemNames[0] || "",
      quantity: "",
      buyPrice: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const itemName = form.itemName.trim();
    const quantity = toNumber(form.quantity);
    const buyPrice = toNumber(form.buyPrice);
    if (!itemName || !quantity || !buyPrice) return;

    const record: StockInRecord = {
      id: editingIndex !== null ? stockIn[editingIndex].id : nextId(),
      date: form.date,
      itemName,
      quantity,
      buyPrice,
    };

    if (editingIndex !== null) {
      onUpdateStockIn(editingIndex, record);
    } else {
      onAddStockIn(record);
    }

    handleCancelEdit();
  };

  const filteredRecords = stockIn
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => {
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      return (
        item.itemName.toLowerCase().includes(query) ||
        item.date.includes(query)
      );
    });

  // Calculate stock balances per item
  const stockBalances = stockIn.reduce((acc, item) => {
    const key = item.itemName.toLowerCase();
    acc[key] = (acc[key] || 0) + item.quantity;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
      {/* Form Panel */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-black text-[#191712]">
          {editingIndex === null ? "Input Barang Masuk" : "Edit Barang Masuk"}
        </h2>
        <p className="text-xs text-[#706858] mt-1 mb-4">
          Catat penerimaan stok barang yang masuk ke gudang / toko.
        </p>

        {isAdmin ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="date"
              label="Tanggal Masuk"
              labelPlacement="outside"
              value={form.date}
              onValueChange={(date) => setForm((prev) => ({ ...prev, date }))}
              radius="sm"
              required
            />

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
                  ⚠️ Belum ada data barang. Buat dulu di menu Master & Cadangan.
                </p>
              )}
            </div>

<div className="space-y-1">
              <label className="text-xs font-semibold text-[#191712]">Stok Masuk (kg)</label>
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
              <label className="text-xs font-semibold text-[#191712]">Harga Beli /kg (Rp)</label>
              <Input
                labelPlacement="outside"
                placeholder="cth. 21000"
                value={form.buyPrice}
                onValueChange={(buyPrice) => setForm((prev) => ({ ...prev, buyPrice }))}
                radius="sm"
                required
                startContent={<span className="text-xs font-bold text-[#706858]">Rp</span>}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="flex-1 bg-[#191712] font-bold text-white shadow-sm"
                radius="sm"
                startContent={editingIndex === null ? <Plus size={16} /> : <Edit2 size={16} />}
              >
                {editingIndex === null ? "Simpan Barang Masuk" : "Simpan Perubahan"}
              </Button>
              {editingIndex !== null && (
                <Button variant="flat" onPress={handleCancelEdit} radius="sm">
                  Batal
                </Button>
              )}
            </div>
          </form>
        ) : (
          <div className="rounded-xl border border-dashed border-[#191712]/20 bg-[#f7f5ef] p-6 text-center">
            <Lock size={20} className="mx-auto mb-2 text-[#706858]" />
            <p className="text-sm font-bold text-[#191712]">Input stok dikunci</p>
            <p className="text-xs text-[#706858] mt-1">
              Hanya admin yang dapat menambah, mengubah, atau menghapus data stok masuk.
            </p>
          </div>
        )}
      </div>

{/* Data List Panel */}
      {isAdmin && (
        <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-black text-[#191712]">Riwayat Barang Masuk</h2>
            <div className="w-full sm:w-64">
              <Input
                size="sm"
                placeholder="Cari barang/tanggal..."
                value={search}
                onValueChange={setSearch}
                startContent={<Search size={14} className="text-[#706858]" />}
                radius="sm"
                isClearable
                onClear={() => setSearch("")}
              />
            </div>
          </div>

          {/* Stock Balance Summary */}
          <div className="rounded-xl bg-[#f7f5ef] p-4 border border-[#191712]/5">
            <h3 className="text-xs font-bold text-[#706858] uppercase mb-2">Ringkasan Stok</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stockBalances).map(([key, qty]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold border border-[#191712]/10"
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}: {shortNumber(qty)} kg
                </span>
              ))}
              {Object.keys(stockBalances).length === 0 && (
                <span className="text-xs text-[#706858]">Belum ada stok tercatat.</span>
              )}
            </div>
          </div>

          <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {filteredRecords.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#706858]">
                Tidak ditemukan catatan barang masuk.
              </div>
            ) : (
              filteredRecords.map(({ item, originalIndex }) => (
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
                        {item.date} • Harga Beli {rupiah(item.buyPrice)} /kg
                      </p>
                    </div>
                    <div className="flex items-center gap-4 justify-between sm:justify-end">
                      <span className="font-mono font-black text-[#1f8f5f]">+{shortNumber(item.quantity)} kg</span>
                      {isAdmin && (
                        <div className="flex gap-1">
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
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteConfirmIndex !== null} onClose={() => setDeleteConfirmIndex(null)} size="sm">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 text-rose-700">
            <AlertCircle size={20} />
            <span>Hapus Catatan Barang Masuk?</span>
          </ModalHeader>
          <ModalBody className="pb-6">
            <p className="text-sm text-slate-700">
              Apakah Anda yakin ingin menghapus data barang masuk untuk{" "}
              <strong>{deleteConfirmIndex !== null ? stockIn[deleteConfirmIndex]?.itemName : ""}</strong>?
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
                    onDeleteStockIn(deleteConfirmIndex);
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

