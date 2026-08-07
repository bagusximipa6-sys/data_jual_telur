import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Skrip migrasi: menjalankan sql/schema.sql terhadap database Vercel Postgres.
// Skrip ini memanggil endpoint API /api/migrate pada aplikasi yang sedang berjalan.
// Cara pakai:
//   1. Jalankan server: npm run dev (atau deploy ke Vercel)
//   2. Jalankan: npx tsx scripts/migrate.ts
//   (bisa juga set env MIGRATE_API_URL untuk menunjuk URL tertentu)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, "../sql/schema.sql");

export async function main(): Promise<void> {
  const schema = await readFile(schemaPath, "utf-8");
  console.log(`📄 Membaca schema dari ${schemaPath} (${schema.length} karakter).`);

  const baseUrl = process.env.MIGRATE_API_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/migrate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schema }),
  });
  const json = (await res.json()) as { ok: boolean; executed?: number; error?: string };
  if (!res.ok || !json.ok) {
    throw new Error(json.error || "Migrasi gagal.");
  }
  console.log(`✅ Migrasi berhasil. ${json.executed ?? 0} statement dijalankan.`);
}

// Jalankan langsung jika dieksekusi sebagai entry point
const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((err) => {
    console.error("❌ Migrasi gagal:", err);
    process.exit(1);
  });
}
