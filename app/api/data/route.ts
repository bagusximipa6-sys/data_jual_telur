import { NextRequest, NextResponse } from "next/server";
import { loadAllData, resetAllData, saveAllData, type AppDataSet } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Tanggal hari ini dalam format ISO (YYYY-MM-DD) menggunakan zona waktu 'Asia/Jakarta'.
// Ini memastikan konsistensi antara server Vercel (UTC) dan localhost (WIB).
function todayISO(): string {
  const d = new Date().toLocaleString("en-CA", { timeZone: "Asia/Jakarta", year: 'numeric', month: '2-digit', day: '2-digit' });
  // toLocaleString dengan en-CA menghasilkan format 'YYYY-MM-DD'
  return d;
}

// Cek apakah sebuah tanggal sudah lewat / terkunci (lebih kecil dari tanggal hari ini).
function isLockedDate(dateISO: string): boolean {
  if (!dateISO) return false;
  // Perbandingan string 'YYYY-MM-DD' aman digunakan.
  // Dengan todayISO() yang sudah diatur ke 'Asia/Jakarta', logika ini akan konsisten
  // di semua lingkungan.
  return dateISO < todayISO();
}

// Deteksi modifikasi data harian pada tanggal lampau (daily lock).
// Karena client mengirim dataset penuh, kita bandingkan dengan data DB:
// hanya tolak jika record bertanggal lampau yang tadinya ada kini DIHAPUS
// atau DIMODIFIKASI (kandungannya berubah). Record lama yang diterima
// apa adanya (read-only) tetap dipersilakan.
type DatedRow = { id?: string; date: string };
type IdentifiedDatedRow = DatedRow & { id: string };

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, value]) => value !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, canonicalValue(value)])
    );
  }

  return value;
}

function canonical(r: unknown): string {
  return JSON.stringify(canonicalValue(r));
}

async function findLockedViolation(data: AppDataSet): Promise<string | null> {
  const existing = await loadAllData();

  const changedById = (
    label: string,
    before: IdentifiedDatedRow[],
    after: IdentifiedDatedRow[]
  ): string | null => {
    const afterById = new Map(after.map((r) => [r.id, r]));

    // Dihapus / hilang?
    for (const r of before) {
      if (isLockedDate(r.date) && !afterById.has(r.id)) {
        return `Data ${label} tanggal ${r.date} sudah terkunci (hari lalu) dan tidak dapat dihapus.`;
      }
    }

    // Dimodifikasi?
    for (const r of before) {
      if (!isLockedDate(r.date)) continue; // Lewati jika data hari ini atau masa depan
      const afterRec = afterById.get(r.id);
      if (afterRec && canonical(r) !== canonical(afterRec)) {
        return `Data ${label} tanggal ${r.date} sudah terkunci (hari lalu) dan tidak dapat diubah.`;
      }
    }
    return null;
  };

  const changedByValue = (
    label: string,
    before: DatedRow[],
    after: DatedRow[]
  ): string | null => {
    const afterCounts = new Map<string, number>();

    for (const r of after) {
      const key = canonical(r);
      afterCounts.set(key, (afterCounts.get(key) ?? 0) + 1);
    }

    for (const r of before) {
      if (!isLockedDate(r.date)) continue;

      const key = canonical(r);
      const count = afterCounts.get(key) ?? 0;
      if (count <= 0) {
        return `Data ${label} tanggal ${r.date} sudah terkunci (hari lalu) dan tidak dapat diubah atau dihapus.`;
      }
      afterCounts.set(key, count - 1);
    }

    return null;
  };

  return (
    changedById("Barang Masuk", existing.stockIn, data.stockIn) ??
    changedById("Barang Keluar", existing.stockOut, data.stockOut) ??
    changedByValue("Laporan Harian", existing.sales, data.sales) ??
    changedByValue("Operasional", existing.ops, data.ops)
  );
}

// GET /api/data -> ambil seluruh data
export async function GET() {
  try {
    const data = await loadAllData();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    // Log error yang lebih detail di sisi server untuk debugging
    console.error("GET /api/data - Database Load Error:", err);
    return NextResponse.json({ ok: false, error: "Gagal memuat data dari database." }, { status: 500 });
  }
}

// POST /api/data -> simpan seluruh data (semua perangkat bisa menyimpan, seperti ayam)
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<AppDataSet>;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Payload tidak valid." }, { status: 400 });
    }

    const data: AppDataSet = {
      sales: body.sales ?? [],
      bakulRecords: body.bakulRecords ?? [],
      ops: body.ops ?? [],
      items: body.items ?? [],
      bakulMasters: body.bakulMasters ?? [],
      stockIn: body.stockIn ?? [],
      stockOut: body.stockOut ?? [],
      priceHistory: body.priceHistory ?? [],
      opsCategories: body.opsCategories ?? [],
    };

    // Defense-in-depth: tolak simpan jika ada data harian pada tanggal lampau
    // yang akan diubah/dihapus (daily lock).
    const violation = await findLockedViolation(data);
    if (violation) {
      return NextResponse.json({ ok: false, error: violation }, { status: 403 });
    }

    await saveAllData(data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Log error yang lebih detail di sisi server untuk debugging
    console.error("POST /api/data - Database Save Error:", err);
    return NextResponse.json({ ok: false, error: "Gagal menyimpan data ke database." }, { status: 500 });
  }
}

// DELETE /api/data -> reset seluruh data (hanya admin)
export async function DELETE(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    await resetAllData();
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Log error yang lebih detail di sisi server untuk debugging
    console.error("DELETE /api/data - Database Reset Error:", err);
    return NextResponse.json({ ok: false, error: "Gagal mereset data." }, { status: 500 });
  }
}
