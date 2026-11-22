import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "@neondatabase/serverless";
import type { PoolClient } from "@neondatabase/serverless";
import { isAdminRequest, unauthorizedResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/migrate -> jalankan sql/schema.sql terhadap database (hanya admin)
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  let client: PoolClient | null = null;
  try {
    // Ambil schema dari body (opsional) atau baca dari file
    let schema: string;
    try {
      const body = (await request.json()) as { schema?: string };
      schema = body?.schema || "";
    } catch {
      schema = "";
    }

    if (!schema) {
      const schemaPath = path.join(process.cwd(), "sql", "schema.sql");
      schema = await readFile(schemaPath, "utf-8");
    }

    // Pecah menjadi statement (pisah per ';')
    const statements = schema
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    client = await pool.connect();

    for (const stmt of statements) {
      await client.query(stmt);
    }

    return NextResponse.json({ ok: true, executed: statements.length });
  } catch (err) {
    console.error("POST /api/migrate error:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  } finally {
    client?.release();
    await pool.end();
  }
}
