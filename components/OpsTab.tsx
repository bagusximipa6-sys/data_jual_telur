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
  Textarea,
} from "@heroui/react";
import { AlertCircle, Edit2, Lock, Plus, Search, Tag } from "lucide-react";
import { useState } from "react";
import { rupiah, toNumber } from "@/lib/utils";
import { OperationalRecord, Role } from "@/types/finance";

interface OpsTabProps {
  ops: OperationalRecord[];
  categories: string[];
  role: Role;
  isRecordLocked?: (date: string | undefined) => boolean;
  onAddOps: (record: OperationalRecord) => void;
  onUpdateOps: (index: number, record: OperationalRecord) => void;
  onDeleteOps: (index: number) => void;
  onAddOpsCategory?: (category: string) => void;
}

const DEFAULT_DATE = new Date().toISOString().slice(0, 10);

export function OpsTab({
  ops,
  categories,
  role,
  isRecordLocked,
  onAddOps,
  onUpdateOps,
  onDeleteOps,
  onAddOpsCategory,
}: OpsTabProps) {
  const [search, setSearch] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState("");

  const [form, setForm] = useState({
    date: DEFAULT_DATE,
    description: categories[0] || "bensin + parkir",
    amount: "",
    note: "",
  });

  const amountNum = toNumber(form.amount);

  const handleStartEdit = (item: OperationalRecord, originalIndex: number) => {
    setEditingIndex(originalIndex);
    setForm({
      date: item.date,
      description: item.description,
      amount: String(item.amount),
      note: item.note,
    });
    setIsCustomCategory(false);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setForm({
      date: DEFAULT_DATE,
      description: categories[0] || "bensin + parkir",
      amount: "",
      note: "",
    });
    setIsCustomCategory(false);
    setCustomCategoryInput("");
  };

const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalDesc = isCustomCategory ? customCategoryInput.trim() : form.description.trim();
    if (!finalDesc || !amountNum) return;

    // Register new custom category to master categories
    if (isCustomCategory && onAddOpsCategory) {
      onAddOpsCategory(finalDesc);
    }

    const record: OperationalRecord = {
      date: form.date,
      description: finalDesc,
      amount: amountNum,
      note: form.note.trim(),
    };

    if (editingIndex !== null) {
      onUpdateOps(editingIndex, record);
    } else {
      onAddOps(record);
    }

    handleCancelEdit();
  };

  // Search filter
  const filteredOps = ops
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => {
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      return (
        item.description.toLowerCase().includes(query) ||
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
              ? "Input Biaya Operasional"
              : "Edit Biaya Operasional"
            : "Akses Mode User"}
        </h2>
        <p className="text-xs text-[#706858] mt-1 mb-4">
          Catat pengeluaran operasional usaha seperti bahan bakar, parkir, konsumsi, atau perawatan.
        </p>

        {role === "admin" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="date"
              label="Tanggal Pengeluaran"
              labelPlacement="outside"
              value={form.date}
              onValueChange={(date) => setForm((prev) => ({ ...prev, date }))}
              radius="sm"
              required
            />

            {!isCustomCategory ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#191712]">Kategori Operasional</label>
                  <button
                    type="button"
                    className="text-[11px] font-bold text-[#1f8f5f] hover:underline flex items-center gap-1"
                    onClick={() => setIsCustomCategory(true)}
                  >
                    <Tag size={12} /> + Tambah Kategori Baru
                  </button>
                </div>
                <Select
                  aria-label="Pilih Kategori Operasional"
                  selectedKeys={[form.description]}
                  onSelectionChange={(keys) => {
                    const selected = String(Array.from(keys)[0] ?? form.description);
                    setForm((prev) => ({ ...prev, description: selected }));
                  }}
                  radius="sm"
                >
                  {categories.map((cat) => (
                    <SelectItem key={cat}>{cat}</SelectItem>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#191712]">Kategori Baru</label>
                  <button
                    type="button"
                    className="text-[11px] font-bold text-[#706858] hover:underline"
                    onClick={() => setIsCustomCategory(false)}
                  >
                    Pilih Dari Daftar
                  </button>
                </div>
                <Input
                  placeholder="Masukkan kategori operasional baru..."
                  value={customCategoryInput}
                  onValueChange={setCustomCategoryInput}
                  radius="sm"
                  required
                />
              </div>
            )}

            <Input
              label="Nominal Biaya (Rp)"
              labelPlacement="outside"
              placeholder="cth. 150000"
              value={form.amount}
              onValueChange={(amount) => setForm((prev) => ({ ...prev, amount }))}
              radius="sm"
              required
            />

            <Textarea
              label="Keterangan Rincian"
              labelPlacement="outside"
              placeholder="Rincian pengeluaran operasional"
              value={form.note}
              onValueChange={(note) => setForm((prev) => ({ ...prev, note }))}
              radius="sm"
            />

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="flex-1 bg-[#191712] font-bold text-white shadow-sm"
                radius="sm"
                startContent={editingIndex === null ? <Plus size={16} /> : <Edit2 size={16} />}
              >
                {editingIndex === null ? "Simpan Biaya Operasional" : "Simpan Perubahan"}
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
            🔒 Mengubah data operasional hanya dapat dilakukan dalam Mode Admin.
          </div>
        )}
      </div>

{/* Data List Panel */}
      {role === "admin" && (
        <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-black text-[#191712]">Rincian Operasional</h2>
            <div className="w-full sm:w-64">
              <Input
                size="sm"
                placeholder="Cari kategori/tanggal..."
                value={search}
                onValueChange={setSearch}
                startContent={<Search size={14} className="text-[#706858]" />}
                radius="sm"
                isClearable
                onClear={() => setSearch("")}
              />
            </div>
          </div>

          <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
            {filteredOps.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#706858]">
                Tidak ditemukan rincian operasional.
              </div>
            ) : (
              filteredOps.map(({ item, originalIndex }) => (
                <Card
                  key={`${item.date}-${item.description}-${originalIndex}`}
                  shadow="none"
                  radius="sm"
                  className="border border-[#191712]/10 bg-white transition-all hover:border-[#191712]/30"
                >
                  <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-black text-[#191712] capitalize flex items-center gap-2">
                        {item.description}
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
                    <div className="flex items-center gap-4 justify-between sm:justify-end">
                      <span className="font-mono font-black text-[#8f321a]">{rupiah(item.amount)}</span>
                      {role === "admin" && !isRecordLocked?.(item.date) && (
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
            <span>Hapus Catatan Operasional?</span>
          </ModalHeader>
          <ModalBody className="pb-6">
            <p className="text-sm text-slate-700">
              Apakah Anda yakin ingin menghapus catatan operasional{" "}
              <strong>{deleteConfirmIndex !== null ? ops[deleteConfirmIndex]?.description : ""}</strong>?
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
                    onDeleteOps(deleteConfirmIndex);
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
