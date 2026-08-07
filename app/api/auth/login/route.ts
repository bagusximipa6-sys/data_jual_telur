import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Password admin disimpan di environment variable, bukan di client.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

// POST /api/auth/login -> verifikasi password admin dan buat session token
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { password?: string };
    const password = body?.password ?? "";

    if (!ADMIN_PASSWORD) {
      return NextResponse.json(
        { ok: false, error: "Server belum dikonfigurasi (ADMIN_PASSWORD belum diset)." },
        { status: 500 }
      );
    }

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ ok: false, error: "Password admin tidak cocok." }, { status: 401 });
    }

    // Set session token sebagai HttpOnly cookie (aman dari akses JS)
    const response = NextResponse.json({ ok: true });
    response.cookies.set("admin_session", "admin", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 jam
    });

    return response;
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    return NextResponse.json({ ok: false, error: "Terjadi kesalahan." }, { status: 500 });
  }
}
