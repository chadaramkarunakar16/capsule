// Optional PIN lock. Server-side only (Node runtime). The PIN is stored as a scrypt hash; sessions are signed, expiring cookies.
import crypto from "node:crypto";
import { readSettings, writeSettings } from "./settings";

export const COOKIE = "capsule_session";
const DAYS = 30;

export const hasPin = () => !!readSettings().pin;

export function setPin(pin: string | null) {
  const s = readSettings();
  if (pin == null) { delete s.pin; s.sessionSecret = crypto.randomBytes(32).toString("hex"); } // removing/changing logs everyone out
  else {
    if (!/^\d{4,12}$/.test(pin)) throw new Error("A PIN is 4 to 12 digits");
    const salt = crypto.randomBytes(16).toString("hex");
    s.pin = { salt, hash: crypto.scryptSync(pin, salt, 32).toString("hex") };
    s.sessionSecret = crypto.randomBytes(32).toString("hex");
  }
  writeSettings(s);
}

export function verifyPin(pin: string): boolean {
  const p = readSettings().pin;
  if (!p) return false;
  const h = crypto.scryptSync(String(pin), p.salt, 32);
  const want = Buffer.from(p.hash, "hex");
  return h.length === want.length && crypto.timingSafeEqual(h, want);
}

function secret(): string {
  const s = readSettings();
  if (!s.sessionSecret) { s.sessionSecret = crypto.randomBytes(32).toString("hex"); writeSettings(s); }
  return s.sessionSecret!;
}
const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("hex");

export function makeToken(now = Date.now()): string {
  const exp = String(now + DAYS * 86400_000);
  return `${exp}.${sign(exp)}`;
}
export function verifyToken(token: string | undefined | null, now = Date.now()): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  const want = sign(exp);
  return sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want));
}
export const cookieOptions = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: DAYS * 86400 };

/** In-memory throttle: 5 wrong PINs per 5 minutes per client. */
const tries = new Map<string, { n: number; t: number }>();
export function throttled(key: string, now = Date.now()): boolean {
  const e = tries.get(key);
  return !!e && now - e.t < 300_000 && e.n >= 5;
}
export function noteFailure(key: string, now = Date.now()) {
  const e = tries.get(key);
  if (!e || now - e.t >= 300_000) tries.set(key, { n: 1, t: now });
  else e.n++;
}
export const clearFailures = (key: string) => tries.delete(key);
