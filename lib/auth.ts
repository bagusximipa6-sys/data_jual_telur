import { NextRequest } from "next/server";

// Helper untuk proteksi route API admin.
// Memeriksa keberadaan cookie session admin.
export function isAdminRequest(request: NextRequest): boolean {
  const session = request.cookies.get("admin_session")?.value;
  return session === "admin";
}

// Factory untuk wrapper respons tidak sah
import { NextResponse } from "next/server";

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
}
