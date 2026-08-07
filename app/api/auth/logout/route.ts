import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/auth/logout -> hapus session token
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("admin_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0, // hapus cookie
  });
  return response;
}
