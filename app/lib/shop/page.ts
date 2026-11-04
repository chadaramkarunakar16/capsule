// "Paste a product link": read a single page the user chose, using only what the page itself publishes
// (schema.org JSON-LD and Open Graph tags). Server-side only.
import dns from "node:dns/promises";
import net from "node:net";
import type { Candidate } from "./types";

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x2F;/g, "/");

function metas(html: string) {
  const m: Record<string, string> = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const val = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (key && val != null && !(key in m)) m[key] = decode(val);
  }
  return m;
}

type Any = Record<string, unknown>;
function* walk(node: unknown): Generator<Any> {
  if (Array.isArray(node)) { for (const n of node) yield* walk(n); return; }
  if (node && typeof node === "object") {
    const o = node as Any;
    yield o;
    for (const k of ["@graph", "mainEntity", "itemListElement", "item"]) if (o[k]) yield* walk(o[k]);
  }
}
const isType = (o: Any, t: string) => { const v = o["@type"]; return v === t || (Array.isArray(v) && v.includes(t)); };
const num = (v: unknown) => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };
const str = (v: unknown): string => (typeof v === "string" ? v : Array.isArray(v) ? str(v[0]) : v && typeof v === "object" ? str((v as Any).url ?? (v as Any).name) : "");

function ldProducts(html: string): Any[] {
  const found: Any[] = [];
  for (const m of html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { for (const o of walk(JSON.parse(decode(m[1].trim())))) if (isType(o, "Product")) found.push(o); } catch { /* ignore broken blocks */ }
  }
  return found;
}

const SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", GBP: "£", EUR: "€", AED: "AED", CAD: "$", AUD: "$", JPY: "¥" };

export function parseProductHtml(html: string, pageUrl: string): Candidate | null {
  const m = metas(html);
  const p = ldProducts(html)[0];
  let price: number | null = null, currency = "", rating: number | null = null, reviews: number | null = null, title = "", image = "", merchant = "";
  if (p) {
    title = str(p.name);
    image = str(p.image);
    const offers = (Array.isArray(p.offers) ? p.offers[0] : p.offers) as Any | undefined;
    if (offers) {
      price = num(offers.price ?? (offers.priceSpecification as Any | undefined)?.price ?? offers.lowPrice);
      currency = str(offers.priceCurrency);
      merchant = str((offers.seller as Any | undefined)?.name);
    }
    const ar = p.aggregateRating as Any | undefined;
    if (ar) { rating = num(ar.ratingValue); reviews = num(ar.reviewCount ?? ar.ratingCount); }
  }
  title ||= m["og:title"] || m["twitter:title"] || "";
  image ||= m["og:image"] || m["twitter:image"] || "";
  price ??= num(m["product:price:amount"] ?? m["og:price:amount"]);
  currency ||= m["product:price:currency"] || m["og:price:currency"] || "";
  merchant ||= m["og:site_name"] || "";
  if (!title) return null;
  let host = "";
  try { host = new URL(pageUrl).hostname.replace(/^www\./, ""); } catch { /* */ }
  let imageUrl = image;
  try { if (image) imageUrl = new URL(image, pageUrl).toString(); } catch { /* */ }
  return {
    title: title.trim().slice(0, 200), merchant: merchant || host, url: pageUrl, imageUrl, price, oldPrice: null,
    currency: SYMBOLS[currency.toUpperCase()] ?? currency, rating, reviews, delivery: "", source: "pasted",
    trust: { level: "unknown", label: "", notes: [] },
  };
}

/* ---------------------------------------------------------------- safe fetching */

function isPrivate(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const x = ip.toLowerCase();
  return x === "::1" || x === "::" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80") || x.startsWith("::ffff:127.") || x.startsWith("::ffff:10.") || x.startsWith("::ffff:192.168.");
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error("That doesn’t look like a link"); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Only web links are supported");
  if (process.env.CAPSULE_ALLOW_PRIVATE_URLS === "1") return u; // for local testing only
  const addrs = net.isIP(u.hostname) ? [{ address: u.hostname }] : await dns.lookup(u.hostname, { all: true }).catch(() => { throw new Error("Couldn’t reach that site"); });
  if (!addrs.length || addrs.some((a) => isPrivate(a.address))) throw new Error("That address isn’t allowed");
  return u;
}

export async function fetchPage(raw: string, maxBytes = 1_500_000): Promise<{ html: string; url: string }> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const r = await fetch(url, {
      redirect: "manual", signal: AbortSignal.timeout(9000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; CapsuleLinkPreview/1.0)", accept: "text/html,application/xhtml+xml" },
    });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { url = await assertPublicUrl(new URL(r.headers.get("location")!, url).toString()); continue; }
    if (!r.ok) throw new Error(`The site answered ${r.status}`);
    const ct = r.headers.get("content-type") ?? "";
    if (!/html|xml/i.test(ct)) throw new Error("That link isn’t a web page");
    const reader = r.body?.getReader();
    if (!reader) throw new Error("Empty response");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length; chunks.push(value);
      if (size > maxBytes) { await reader.cancel(); break; }
    }
    return { html: Buffer.concat(chunks).toString("utf8"), url: url.toString() };
  }
  throw new Error("Too many redirects");
}
