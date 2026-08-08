import { NextRequest, NextResponse } from "next/server";
import { loadAllData, resetAllData, saveAllData, type AppDataSet } from "@/lib/db";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Tanggal hari ini dalam format ISO (YYYY-MM-DD) menggunakan zona waktu lokal.
function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Cek apakah sebuah tanggal sudah lewat / terkunci (lebih kecil dari tanggal hari ini).
function isLockedDate(dateISO: string): boolean {
  if (!dateISO) return false;
  return dateISO < todayISO();
}

// Deteksi modifikasi data harian pada tanggal lampau (daily lock).
// Karena client mengirim dataset penuh, kita bandingkan dengan data DB:
// hanya tolak jika record bertanggal lampau yang tadinya ada kini DIHAPUS
// atau DIMODIFIKASI (kandungannya berubah). Record lama yang diterima
// apa adanya (read-only) tetap dipersilakan.
type DatedRow = { id?: string; date: string };

function canonical(r: unknown): string {
  return JSON.stringify(r);
}

async function findLockedViolation(data: AppDataSet): Promise<string | null> {
  const existing = await loadAllData();
  const today = todayISO();

  const changed = (
    label: string,
    key: (r: DatedRow) => string,
    before: DatedRow[],
    after: DatedRow[]
  ): string | null => {
    const afterIds = new Set(after.map((r) => key(r)));
    // Dihapus / hilang?
    for (const r of before) {
      if (isLockedDate(r.date) && r.date < today && !afterIds.has(key(r))) {
        return `Data ${label} tanggal ${r.date} sudah terkunci (hari lalu) dan tidak dapat dihapus.`;
      }
    }
    // Dimodifikasi?
    for (const r of before) {
      if (!isLockedDate(r.date)) continue;
      const afterRec = after.find((a) => key(a) === key(r));
      if (afterRec && canonical(r) !== canonical(afterRec)) {
        return `Data ${label} tanggal ${r.date} sudah terkunci (hari lalu) dan tidak dapat diubah.`;
      }
    }
    return null;
  };

  return (
    changed("Barang Masuk", (r) => r.id ?? r.date, existing.stockIn, data.stockIn) ??
    changed("Barang Keluar", (r) => r.id ?? r.date, existing.stockOut, data.stockOut) ??
    changed("Laporan Harian", (r) => r.id ?? r.date, existing.sales, data.sales) ??
    changed("Piutang Bakul", (r) => r.id ?? r.date, existing.bakulRecords, data.bakulRecords) ??
    changed("Operasional", (r) => r.id ?? r.date, existing.ops, data.ops)
  );
}

// GET /api/data -> ambil seluruh data
export async function GET() {
  try {
    const data = await loadAllData();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("GET /api/data error:", err);
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
    const violation = findLockedViolation(data);
    if (violation) {
      return NextResponse.json({ ok: false, error: violation }, { status: 403 });
    }

    await saveAllData(data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/data error:", err);
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
    console.error("DELETE /api/data error:", err);
    return NextResponse.json({ ok: false, error: "Gagal mereset data." }, { status: 500 });
  }
}
