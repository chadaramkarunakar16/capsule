import { NextResponse } from "next/server";
import { COOKIE, cookieOptions, hasPin, makeToken, setPin, verifyPin, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** body: { current?: string, pin: string | null }. Setting or changing a PIN signs every other device out. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const cookie = req.headers.get("cookie")?.match(new RegExp(`${COOKIE}=([^;]+)`))?.[1];
  if (hasPin() && !(verifyToken(cookie) && verifyPin(String(b.current ?? "")))) return NextResponse.json({ error: "Enter your current PIN to change it" }, { status: 401 });
  try { setPin(b.pin == null ? null : String(b.pin)); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn’t set the PIN" }, { status: 400 }); }
  const res = NextResponse.json({ ok: true, pin: hasPin() });
  if (hasPin()) res.cookies.set(COOKIE, makeToken(), cookieOptions); // keep this device signed in
  else res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET() {
  return NextResponse.json({ pin: hasPin() });
}
