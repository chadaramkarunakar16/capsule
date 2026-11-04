import { fail, get, ok, run } from "@/lib/db";
import { createProduct, listProducts, mapProduct } from "@/lib/shop/db";
import { assessTrust } from "@/lib/shop/trust";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get("saved") === "1") return ok(listProducts("WHERE saved = 1"));
  const look = u.searchParams.get("look");
  return ok(look ? listProducts("WHERE look_id = ?", look) : listProducts());
}

// Create (or update, when the same link is already stored for this look/piece) a product.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || !b.title || !b.url) return fail("title and url required");
  try { if (!/^https?:$/.test(new URL(b.url).protocol)) throw new Error(); } catch { return fail("url must be a web link"); }
  const dup = get("SELECT * FROM products WHERE url = ? AND COALESCE(look_id,'') = COALESCE(?,'') AND COALESCE(piece_id,'') = COALESCE(?,'')", b.url, b.lookId ?? null, b.pieceId ?? null);
  if (dup) {
    if (b.selected != null) run("UPDATE products SET selected = ?, updated_at = datetime('now') WHERE id = ?", b.selected ? 1 : 0, dup.id);
    if (b.saved != null) run("UPDATE products SET saved = ?, updated_at = datetime('now') WHERE id = ?", b.saved ? 1 : 0, dup.id);
    return ok(mapProduct(get("SELECT * FROM products WHERE id = ?", dup.id)!));
  }
  const trust = b.trust?.label ? b.trust : assessTrust({ merchant: b.merchant ?? "", url: b.url, price: b.price ?? null, rating: b.rating ?? null, reviews: b.reviews ?? null });
  // only one chosen product per piece
  if (b.selected && b.lookId && b.pieceId) run("UPDATE products SET selected = 0 WHERE look_id = ? AND piece_id = ?", b.lookId, b.pieceId);
  return ok(createProduct({ ...b, trust }), 201);
}
