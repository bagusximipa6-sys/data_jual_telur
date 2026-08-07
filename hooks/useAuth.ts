"use client";

import { useState } from "react";
import type { Key } from "react";
import type { Role } from "@/types/finance";

export function useAuth() {
  const [role, setRole] = useState<Role>("user");
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  // Login: verifikasi password di server via /api/auth/login
  const handleUnlockAdmin = async (password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (res.ok && json.ok) {
        setAdminUnlocked(true);
        setRole("admin");
        return true;
      }
      return false;
    } catch (err) {
      console.error("Login gagal:", err);
      return false;
    }
  };

  // Logout: hapus session di server
  const handleLogoutAdmin = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout gagal:", err);
    }
    setAdminUnlocked(false);
    setRole("user");
  };

  const handleRoleChange = (key: Key) => {
    const nextRole = String(key) as Role;
    if (nextRole === "admin" && !adminUnlocked) {
      return;
    }
    setRole(nextRole);
  };

  return {
    role,
    adminUnlocked,
    handleUnlockAdmin,
    handleLogoutAdmin,
    handleRoleChange,
  };
}
