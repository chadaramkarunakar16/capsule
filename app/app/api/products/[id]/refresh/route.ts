import { fail, get, ok, run } from "@/lib/db";
import { mapProduct } from "@/lib/shop/db";
import { fetchPage, parseProductHtml } from "@/lib/shop/page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Re-read the product page the user saved and record the current price (price history, drop badge).
export async function POST(_r: Request, ctx: RouteContext<"/api/products/[id]/refresh">) {
  const { id } = await ctx.params;
  const r = get("SELECT * FROM products WHERE id = ?", id);
  if (!r) return fail("not found", 404);
  try {
    const { html, url } = await fetchPage(r.url);
    const c = parseProductHtml(html, url);
    if (!c || c.price == null) return fail("Couldn’t read a price from that page any more", 422);
    if (c.price !== r.price) run("INSERT INTO price_history (product_id, price) VALUES (?, ?)", id, c.price);
    run("UPDATE products SET price = ?, old_price = ?, rating = COALESCE(?, rating), reviews = COALESCE(?, reviews), updated_at = datetime('now') WHERE id = ?", c.price, r.price !== c.price ? r.price : r.old_price, c.rating, c.reviews, id);
    return ok(mapProduct(get("SELECT * FROM products WHERE id = ?", id)!));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Refresh failed", 422);
  }
}
