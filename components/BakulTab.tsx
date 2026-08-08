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
  Progress,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { AlertCircle, Edit2, Lock, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { rupiah, toNumber } from "@/lib/utils";
import { BakulRecord, Role } from "@/types/finance";

interface BakulTabProps {
  bakulRecords: BakulRecord[];
  bakulNames: string[];
  role: Role;
  isRecordLocked?: (date: string | undefined) => boolean;
  onAddBakul: (record: BakulRecord) => void;
  onUpdateBakul: (index: number, record: BakulRecord) => void;
  onDeleteBakul: (index: number) => void;
}

const DEFAULT_DATE = new Date().toISOString().slice(0, 10);

export function BakulTab({
  bakulRecords,
  bakulNames,
  role,
  isRecordLocked,
  onAddBakul,
  onUpdateBakul,
  onDeleteBakul,
}: BakulTabProps) {
const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState<string>("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const [isCustomName, setIsCustomName] = useState(false);
  const [customNameInput, setCustomNameInput] = useState("");

  const [form, setForm] = useState({
    date: DEFAULT_DATE,
    name: bakulNames[0] || "Demak",
    bill: "",
    paid: "",
    note: "",
  });

  const billNum = toNumber(form.bill);
  const paidNum = toNumber(form.paid);
  const liveBalance = billNum - paidNum;

  const handleStartEdit = (item: BakulRecord, originalIndex: number) => {
    setEditingIndex(originalIndex);
    setForm({
      date: item.date,
      name: item.name,
      bill: String(item.bill),
      paid: String(item.paid),
      note: item.note,
    });
    setIsCustomName(false);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setForm({
      date: DEFAULT_DATE,
      name: bakulNames[0] || "Demak",
      bill: "",
      paid: "",
      note: "",
    });
    setIsCustomName(false);
    setCustomNameInput("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = isCustomName ? customNameInput.trim() : form.name.trim();
    if (!finalName || !billNum) return;

    const record: BakulRecord = {
      date: form.date,
      name: finalName,
      bill: billNum,
      paid: paidNum,
      balance: liveBalance,
      note: form.note.trim(),
    };

    if (editingIndex !== null) {
      onUpdateBakul(editingIndex, record);
    } else {
      onAddBakul(record);
    }

    handleCancelEdit();
  };

// Search + date filter
  const filteredRecords = bakulRecords
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => {
      if (filterDate && item.date !== filterDate) return false;
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      return (
        item.name.toLowerCase().includes(query) ||
        item.date.includes(query) ||
        item.note.toLowerCase().includes(query)
      );
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
      {/* Form Panel */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-black text-[#191712]">
          {role === "admin"
            ? editingIndex === null
              ? "Input Tagihan Bakul"
              : "Edit Tagihan Bakul"
            : "Akses Mode User"}
        </h2>
        <p className="text-xs text-[#706858] mt-1 mb-4">
          Catat transaksi piutang dan pembayaran dari bakul / pelanggan.
        </p>

        {role === "admin" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="date"
              label="Tanggal Transaksi"
              labelPlacement="outside"
              value={form.date}
              onValueChange={(date) => setForm((prev) => ({ ...prev, date }))}
              radius="sm"
              required
            />

            {!isCustomName ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#191712]">Nama Bakul</label>
                  <button
                    type="button"
                    className="text-[11px] font-bold text-[#1f8f5f] hover:underline flex items-center gap-1"
                    onClick={() => setIsCustomName(true)}
                  >
                    <UserPlus size={12} /> + Tambah Nama Baru
                  </button>
                </div>
                <Select
                  aria-label="Pilih Nama Bakul"
                  selectedKeys={[form.name]}
                  onSelectionChange={(keys) => {
                    const selected = String(Array.from(keys)[0] ?? form.name);
                    setForm((prev) => ({ ...prev, name: selected }));
                  }}
                  radius="sm"
                >
                  {bakulNames.map((name) => (
                    <SelectItem key={name}>{name}</SelectItem>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#191712]">Nama Bakul Baru</label>
                  <button
                    type="button"
                    className="text-[11px] font-bold text-[#706858] hover:underline"
                    onClick={() => setIsCustomName(false)}
                  >
                    Pilih Dari Daftar
                  </button>
                </div>
                <Input
                  placeholder="Masukkan nama bakul baru..."
                  value={customNameInput}
                  onValueChange={setCustomNameInput}
                  radius="sm"
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Jumlah Tagihan (Rp)"
                labelPlacement="outside"
                placeholder="cth. 2500000"
                value={form.bill}
                onValueChange={(bill) => setForm((prev) => ({ ...prev, bill }))}
                radius="sm"
                required
              />
              <Input
                label="Jumlah Dibayar (Rp)"
                labelPlacement="outside"
                placeholder="cth. 2000000"
                value={form.paid}
                onValueChange={(paid) => setForm((prev) => ({ ...prev, paid }))}
                radius="sm"
              />
            </div>

            <Textarea
              label="Keterangan"
              labelPlacement="outside"
              placeholder="Catatan tambahan pembayaran / sisa"
              value={form.note}
              onValueChange={(note) => setForm((prev) => ({ ...prev, note }))}
              radius="sm"
            />

            {/* Balance Preview */}
            <div className="rounded-xl bg-[#f7f5ef] p-4 text-xs flex justify-between items-center border border-[#191712]/5">
              <span className="font-bold text-[#706858]">Sisa Piutang Transaksi Ini:</span>
              <span
                className={`font-mono font-black text-sm ${
                  liveBalance > 0 ? "text-[#e05234]" : "text-[#1f8f5f]"
                }`}
              >
                {rupiah(liveBalance)}
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="flex-1 bg-[#191712] font-bold text-white shadow-sm"
                radius="sm"
                startContent={editingIndex === null ? <Plus size={16} /> : <Edit2 size={16} />}
              >
                {editingIndex === null ? "Simpan Tagihan Bakul" : "Simpan Perubahan"}
              </Button>
              {editingIndex !== null && (
                <Button variant="flat" onPress={handleCancelEdit} radius="sm">
                  Batal
                </Button>
              )}
            </div>
          </form>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900">
            🔒 Mengubah data bakul hanya dapat dilakukan dalam Mode Admin.
          </div>
        )}
      </div>

      {/* Data List Panel */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
<h2 className="text-xl font-black text-[#191712]">Catatan Piutang Bakul</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="date"
              size="sm"
              className="w-full sm:w-[160px]"
              value={filterDate}
              onValueChange={setFilterDate}
              aria-label="Filter Tanggal"
              radius="sm"
              isClearable
              onClear={() => setFilterDate("")}
            />
            <div className="w-full sm:w-64">
              <Input
                size="sm"
                placeholder="Cari nama/tanggal..."
                value={search}
                onValueChange={setSearch}
                startContent={<Search size={14} className="text-[#706858]" />}
                radius="sm"
                isClearable
                onClear={() => setSearch("")}
              />
            </div>
          </div>
        </div>

        <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
          {filteredRecords.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#706858]">
              Tidak ditemukan catatan bakul.
            </div>
          ) : (
            filteredRecords.map(({ item, originalIndex }) => {
              const paidPercent = item.bill
                ? Math.min(100, Math.max(0, Math.round((item.paid / item.bill) * 100)))
                : 0;

              return (
                <Card
                  key={`${item.date}-${item.name}-${originalIndex}`}
                  shadow="none"
                  radius="sm"
                  className="border border-[#191712]/10 bg-white transition-all hover:border-[#191712]/30"
                >
                  <CardBody className="gap-3 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-black text-base text-[#191712] flex items-center gap-2">
                          {item.name}
                          {isRecordLocked?.(item.date) && (
                            <span className="rounded-full bg-[#e2e8f0] px-2 py-0.5 text-[9px] font-bold text-[#475569] uppercase flex items-center gap-0.5">
                              <Lock size={9} /> Terkunci
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-[#706858] font-medium">
                          {item.date} {item.note ? `• ${item.note}` : ""}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] uppercase font-bold text-[#706858] block">
                          Sisa Piutang
                        </span>
                        <span
                          className={`font-mono font-black ${
                            item.balance > 0 ? "text-[#e05234]" : "text-[#1f8f5f]"
                          }`}
                        >
                          {rupiah(item.balance)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-[#f7f5ef] p-2">
                        <span className="text-[10px] text-[#706858] uppercase block">Tagihan</span>
                        <span className="font-bold">{rupiah(item.bill)}</span>
                      </div>
                      <div className="rounded-lg bg-[#f7f5ef] p-2">
                        <span className="text-[10px] text-[#706858] uppercase block">Dibayar</span>
                        <span className="font-bold text-[#1f8f5f]">{rupiah(item.paid)}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold text-[#706858]">
                        <span>Status Pembayaran</span>
                        <span>{paidPercent}% Lunas</span>
                      </div>
                      <Progress
                        aria-label={`Progress tagihan ${item.name}`}
                        value={paidPercent}
                        size="sm"
                        classNames={{ indicator: paidPercent === 100 ? "bg-[#1f8f5f]" : "bg-[#e05234]" }}
                      />
                    </div>

                    {role === "admin" && !isRecordLocked?.(item.date) && (
                      <div className="flex gap-2 pt-1 border-t border-[#191712]/5">
                        <Button
                          size="sm"
                          variant="flat"
                          className="font-bold"
                          onPress={() => handleStartEdit(item, originalIndex)}
                          radius="sm"
                          startContent={<Edit2 size={14} />}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          className="bg-[#ffe2d8] font-bold text-[#8f321a] hover:bg-[#ffd1c2]"
                          startContent={<Trash2 size={14} />}
                          onPress={() => setDeleteConfirmIndex(originalIndex)}
                          radius="sm"
                        >
                          Hapus
                        </Button>
                      </div>
                    )}
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
            <span>Hapus Catatan Bakul?</span>
          </ModalHeader>
          <ModalBody className="pb-6">
            <p className="text-sm text-slate-700">
              Apakah Anda yakin ingin menghapus data tagihan untuk{" "}
              <strong>{deleteConfirmIndex !== null ? bakulRecords[deleteConfirmIndex]?.name : ""}</strong>?
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
                    onDeleteBakul(deleteConfirmIndex);
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
