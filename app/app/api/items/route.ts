import { ITEM_SELECT, all, fail, mapItem, ok, run, uid, get } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status");
  const rows = status
    ? all(`${ITEM_SELECT} WHERE i.status = ? ORDER BY i.created_at DESC`, status)
    : all(`${ITEM_SELECT} ORDER BY i.created_at DESC`);
  return ok(rows.map(mapItem));
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || !b.image) return fail("image required");
  const id = uid();
  run(
    `INSERT INTO items (id,name,brand,category,color_name,color_hex,pattern,fit,formality,season,size,price,purchase_date,notes,attrs,image,original,status,ai_tagged)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    b.name ?? "",
    b.brand ?? "",
    b.category ?? "Tops",
    b.colorName ?? "",
    b.colorHex ?? "#cccccc",
    b.pattern ?? "solid",
    b.fit ?? "",
    b.formality ?? 1,
    b.season ?? "all",
    b.size ?? "",
    b.price ?? null,
    b.purchaseDate ?? null,
    b.notes ?? "",
    JSON.stringify(b.attrs ?? {}),
    b.image,
    b.original ?? null,
    b.status ?? "active",
    b.aiTagged ? 1 : 0,
  );
  return ok(mapItem(get(`${ITEM_SELECT} WHERE i.id = ?`, id)!), 201);
}
