import { NextResponse } from "next/server";
import { COOKIE, clearFailures, cookieOptions, hasPin, makeToken, noteFailure, throttled, verifyPin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!hasPin()) return NextResponse.json({ ok: true });
  const who = req.headers.get("x-forwarded-for") ?? "local";
  if (throttled(who)) return NextResponse.json({ error: "Too many tries. Wait a few minutes." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  if (!verifyPin(String(b.pin ?? ""))) { noteFailure(who); return NextResponse.json({ error: "That PIN isn’t right" }, { status: 401 }); }
  clearFailures(who);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, makeToken(), cookieOptions);
  return res;
}
