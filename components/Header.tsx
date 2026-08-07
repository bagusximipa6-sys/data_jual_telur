"use client";

import {
  Button,
  Chip,
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
import { CloudCog, CloudOff, Loader, LockKeyhole, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { Key, useState } from "react";
import { Role } from "@/types/finance";
import type { SyncStatus } from "@/lib/sync";

interface HeaderProps {
  stockOutCount: number;
  role: Role;
  adminUnlocked: boolean;
  onRoleChange: (key: Key) => void;
  onUnlockAdmin: (password: string) => Promise<boolean> | boolean;
  onLogoutAdmin: () => void;
  selectedMonth: string;
  availableMonths: string[];
  onMonthChange: (month: string) => void;
  syncStatus: SyncStatus;
}

function SyncStatusIndicator({ status }: { status: SyncStatus }) {
  const indicators = {
    loading: {
      icon: <Loader size={14} className="animate-spin" />,
      text: "Memuat...",
      color: "text-[#706858]",
    },
    saving: {
      icon: <CloudCog size={14} className="animate-pulse" />,
      text: "Menyimpan...",
      color: "text-blue-600",
    },
    saved: {
      icon: <ShieldCheck size={14} />,
      text: "Tersimpan",
      color: "text-green-600",
    },
    offline: {
      icon: <CloudOff size={14} />,
      text: "Offline",
      color: "text-slate-500",
    },
    error: {
      icon: <CloudOff size={14} />,
      text: "Gagal",
      color: "text-red-600",
    },
  };

  const current = indicators[status];

  return (
    <div
      className={`hidden items-center gap-1.5 rounded-lg bg-[#f0eadb] px-3 py-2 text-xs font-bold sm:flex ${current.color}`}
    >
      {current.icon}
      <span className="hidden md:inline">{current.text}</span>
    </div>
  );
}

export function Header({
  stockOutCount,
  role,
  adminUnlocked,
  onRoleChange,
  onUnlockAdmin,
  onLogoutAdmin,
  selectedMonth,
  availableMonths,
  onMonthChange,
  syncStatus,
}: HeaderProps) {
const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  const handleTabsChange = (key: Key) => {
    const nextRole = String(key) as Role;
    if (nextRole === "admin" && !adminUnlocked) {
      setShowAdminModal(true);
      setAdminError("");
      return;
    }
    onRoleChange(key);
  };

const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSubmitting(true);
    setAdminError("");
    try {
      const success = await onUnlockAdmin(adminPassword);
      if (success) {
        setShowAdminModal(false);
        setAdminPassword("");
        setAdminError("");
      } else {
        setAdminError("Password admin tidak cocok");
      }
    } catch {
      setAdminError("Terjadi kesalahan saat verifikasi. Coba lagi.");
    } finally {
      setAdminSubmitting(false);
    }
  };

  return (
    <header className="border-b border-[#191712]/10 bg-white/80 backdrop-blur-md sticky top-0 z-40">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d9ff67] to-[#b3e619] shadow-sm text-[#191712]">
            <Sparkles size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#706858]">
                Buku Keuangan Digital
              </span>
              <Chip className="bg-[#d9ff67] px-2 font-extrabold text-[#191712]" size="sm" variant="flat">
                {stockOutCount} Transaksi
              </Chip>
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl text-[#191712]">
              Data Penjualan Telur
            </h1>
          </div>
        </div>

<div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
          {/* Sync Status Indicator */}
          <SyncStatusIndicator status={syncStatus} />

          {/* Month Selector */}
          {availableMonths.length > 0 && (
            <div className="w-full sm:w-auto sm:min-w-[160px]">
              <Select
                aria-label="Pilih Periode Bulan"
                size="sm"
                selectedKeys={[selectedMonth]}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0];
                  if (val) onMonthChange(String(val));
                }}
                className="bg-[#f7f5ef] rounded-lg font-bold"
                radius="sm"
              >
                {availableMonths.map((month) => (
                 <SelectItem key={month}>
                    {month}
                  </SelectItem>
                ))}
              </Select>
            </div>
          )}
{/* Role Switcher */}
          <Tabs
            selectedKey={role}
            onSelectionChange={handleTabsChange}
            radius="sm"
            size="sm"
            classNames={{
              tabList: "w-full sm:w-auto bg-[#f0eadb] shadow-inner p-1",
              cursor: "bg-[#191712] shadow-sm",
              tabContent: "font-bold text-[#6f6758] group-data-[selected=true]:text-white",
            }}
          >
            <Tab key="user" title="Mode User" />
            <Tab
              key="admin"
              title={
                <span className="flex items-center gap-1">
                  {adminUnlocked ? <ShieldCheck size={14} /> : <LockKeyhole size={14} />}
                  {adminUnlocked ? "Mode Admin" : "Admin Terkunci"}
                </span>
              }
            />
          </Tabs>

          {adminUnlocked && (
            <Button
              size="sm"
              variant="flat"
              radius="sm"
              className="bg-[#ffe2d8] font-bold text-[#8f321a] hover:bg-[#ffd1c2]"
              startContent={<LogOut size={16} />}
              onPress={onLogoutAdmin}
            >
              Keluar Admin
            </Button>
          )}
        </div>
      </div>

      {/* Admin Unlock Modal */}
      <Modal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} size="sm">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <LockKeyhole size={20} className="text-[#191712]" />
            <span>Masukkan Password Admin</span>
          </ModalHeader>
          <ModalBody className="pb-6">
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <Input
                type="password"
                label="Password"
                placeholder="Masukkan password admin..."
                value={adminPassword}
                onValueChange={setAdminPassword}
                isInvalid={Boolean(adminError)}
                errorMessage={adminError}
                radius="sm"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="flat" radius="sm" onPress={() => setShowAdminModal(false)}>
                  Batal
                </Button>
<Button
                  type="submit"
                  className="bg-[#191712] font-bold text-white"
                  radius="sm"
                  isLoading={adminSubmitting}
                >
                  Buka Admin
                </Button>
              </div>
            </form>
          </ModalBody>
        </ModalContent>
      </Modal>
    </header>
  );
}
