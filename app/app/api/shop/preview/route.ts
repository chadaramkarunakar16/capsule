import { fail, ok } from "@/lib/db";
import { fetchPage, parseProductHtml } from "@/lib/shop/page";
import { assessTrust } from "@/lib/shop/trust";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reads the one page the user pasted (schema.org / Open Graph data only) and returns a product draft.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const raw = String(b?.url ?? "").trim();
  if (!raw) return fail("url required");
  try {
    const { html, url } = await fetchPage(raw);
    const c = parseProductHtml(html, url);
    if (!c) return fail("Couldn’t find a product on that page. You can still save the link with a name.", 422);
    return ok({ ...c, trust: assessTrust(c) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn’t read that page", 422);
  }
}
