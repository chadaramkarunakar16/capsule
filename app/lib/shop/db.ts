// Server-side persistence helpers for looks and products.
import { all, get, run, uid, type Row } from "../db";
import type { Look, Piece, Product, Trust } from "./types";

export function mapLook(r: Row): Look {
  let pieces: Piece[] = [];
  try { pieces = JSON.parse(r.pieces || "[]"); } catch { /* keep empty */ }
  return { id: r.id, image: r.image, sourceUrl: r.source_url, note: r.note, pieces, analysed: !!r.analysed, createdAt: r.created_at };
}

export function mapProduct(r: Row): Product {
  let trust: Trust = { level: "unknown", label: "Unverified store", notes: [] };
  try { trust = JSON.parse(r.trust); } catch { /* default */ }
  return {
    id: r.id, lookId: r.look_id ?? null, pieceId: r.piece_id ?? null, title: r.title, merchant: r.merchant, url: r.url, imageUrl: r.image_url,
    price: r.price ?? null, oldPrice: r.old_price ?? null, currency: r.currency, rating: r.rating ?? null, reviews: r.reviews ?? null,
    delivery: r.delivery, source: r.source, trust, selected: !!r.selected, saved: !!r.saved, firstPrice: r.first_price ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export const getLook = (id: string) => { const r = get("SELECT * FROM looks WHERE id = ?", id); return r ? mapLook(r) : null; };
export const listProducts = (where = "", ...p: unknown[]) => all(`SELECT * FROM products ${where} ORDER BY updated_at DESC`, ...p).map(mapProduct);

export function createProduct(b: Partial<Product> & { title: string; url: string }): Product {
  const id = uid();
  run(
    `INSERT INTO products (id,look_id,piece_id,title,merchant,url,image_url,price,old_price,currency,rating,reviews,delivery,source,trust,selected,saved,first_price)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, b.lookId ?? null, b.pieceId ?? null, b.title, b.merchant ?? "", b.url, b.imageUrl ?? "", b.price ?? null, b.oldPrice ?? null, b.currency ?? "",
    b.rating ?? null, b.reviews ?? null, b.delivery ?? "", b.source ?? "pasted", JSON.stringify(b.trust ?? {}), b.selected ? 1 : 0, b.saved ? 1 : 0, b.price ?? null,
  );
  if (b.price != null) run("INSERT INTO price_history (product_id, price) VALUES (?, ?)", id, b.price);
  return mapProduct(get("SELECT * FROM products WHERE id = ?", id)!);
}
