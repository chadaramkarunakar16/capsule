import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, hasPin, verifyToken } from "@/lib/auth";

// Runs in front of every page and API call.
//  • Default (localhost only): open, unless you've set a PIN.
//  • "npm run lan" (reachable from your phone): refuses everything until a PIN exists, then requires it.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const pin = hasPin();
  const lan = process.env.CAPSULE_LAN === "1";
  const isApi = pathname.startsWith("/api/");

  if (lan && !pin) {
    const msg = "Remote access is off. Set a PIN on the computer first (Me → Privacy & data → Set a PIN), then restart with npm run lan.";
    return isApi ? NextResponse.json({ error: msg }, { status: 403 }) : new NextResponse(`<!doctype html><meta name=viewport content="width=device-width"><body style="font:16px system-ui;padding:32px;max-width:480px;margin:auto"><h2>Capsule is locked</h2><p>${msg}</p>`, { status: 403, headers: { "content-type": "text/html; charset=utf-8" } });
  }
  if (!pin) return NextResponse.next();

  const open = pathname === "/unlock" || pathname.startsWith("/api/auth/");
  const res = open || verifyToken(req.cookies.get(COOKIE)?.value) ? NextResponse.next() : isApi
    ? NextResponse.json({ error: "Locked — enter your PIN", locked: true }, { status: 401 })
    : NextResponse.redirect(new URL("/unlock", req.url));
  res.headers.set("x-capsule-pin", "1"); // tells the offline cache not to keep anything
  return res;
}

export const config = {
  // everything except static assets that carry no personal data
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|mediapipe/|manifest.webmanifest|sw.js).*)"],
};
