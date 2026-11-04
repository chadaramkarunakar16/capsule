"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, img } from "@/lib/api";
import { downscaleJpeg } from "@/lib/image";
import { rankProducts, matchOwned } from "@/lib/shop/rank";
import { COUNTRIES, searchLinks } from "@/lib/shop/stores";
import type { Candidate, Piece, Product, Ranked } from "@/lib/shop/types";
import { nameColor } from "@/lib/style/colornames";
import { CATEGORIES } from "@/lib/types";
import { Overlay, Sheet, uid, Img, SecretKey } from "./ui";
import { useStore } from "./store";

type Settings = Awaited<ReturnType<typeof api.settings>>;
type LookData = Awaited<ReturnType<typeof api.look>>;

const money = (n: number | null, cur: string) => (n == null ? "—" : `${cur || ""}${Math.round(n).toLocaleString("en-IN")}`);
const FITS = ["", "slim", "fitted", "regular", "relaxed", "oversized", "straight", "wide", "cropped"];

export function buildQuery(p: { name: string; colorName: string; fit: string; pattern: string; material?: string }, direction: string) {
  const who = direction === "Menswear" ? "men" : direction === "Womenswear" ? "women" : "";
  const words = [who, p.colorName, p.fit && p.fit !== "regular" ? p.fit : "", p.pattern && p.pattern !== "solid" ? p.pattern : "", p.material ?? "", p.name].join(" ").toLowerCase().split(/\s+/).filter(Boolean);
  return [...new Set(words)].join(" ");
}

/* ------------------------------------------------------------------ start a look from an image */

export function useStartLook() {
  const { refresh, push, toast, setSheet } = useStore();
  const [busy, setBusy] = useState(false);
  const start = useCallback(async (file: Blob | null, existingImage?: string, sourceUrl = "") => {
    setBusy(true);
    try {
      let image = existingImage;
      if (!image) {
        const jpg = await downscaleJpeg(file!, 1600);
        image = (await api.upload(jpg)).image;
      }
      const look = await api.createLook({ image, sourceUrl });
      await refresh();
      setSheet(null);
      push({ t: "look", id: look.id });
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't start that look"); }
    setBusy(false);
  }, [refresh, push, toast, setSheet]);
  return { start, busy };
}

export function ShopLookSheet({ onClose }: { onClose: () => void }) {
  const { start, busy } = useStartLook();
  const [link, setLink] = useState("");
  const input = useRef<HTMLInputElement>(null);
  return (
    <Sheet onClose={() => !busy && onClose()}>
      <h2 className="h-l" style={{ marginBottom: 6 }}>Shop a look</h2>
      <p className="sm muted" style={{ marginBottom: 12, lineHeight: 1.5 }}>Screenshot or save an outfit from Instagram or Pinterest, then add it here. Capsule finds the pieces, checks what you already own, and helps you find the rest.</p>
      <div className="drop">
        <button className="btn dark" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Opening…" : "Choose the photo"}</button>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) start(f, undefined, link.trim()).then(onClose); }} />
      </div>
      <input className="input" style={{ marginTop: 10 }} placeholder="Link to the post (optional)" value={link} onChange={(e) => setLink(e.target.value)} />
      <p className="xs muted" style={{ marginTop: 8, lineHeight: 1.5 }}>Tip: install Capsule as an app (browser menu → Install) and you can use <b>Share → Capsule</b> straight from Instagram and Pinterest.</p>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ the look screen */

export function LookView({ id }: { id: string }) {
  const { pop, gitems, profile, refresh } = useStore();
  const [data, setData] = useState<LookData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [editing, setEditing] = useState<Piece | "new" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await api.look(id)); } catch { pop(); }
  }, [id, pop]);
  useEffect(() => { load(); api.settings().then(setSettings).catch(() => {}); /* eslint-disable-next-line */ }, [id]);

  const direction = profile.basics.direction;
  const pieces = data?.pieces ?? [];
  const products = data?.products ?? [];

  async function analyse() {
    setAnalysing(true); setErr(null);
    try {
      const r = await api.analyseLook(id);
      if (!r.aiAvailable) setErr("Automatic piece-finding needs a Gemini key (Me → AI). You can add the pieces yourself below.");
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't analyse this photo"); }
    setAnalysing(false);
  }
  // analyse automatically the first time when an AI key exists
  const auto = useRef(false);
  useEffect(() => { if (data && !data.analysed && settings?.aiAvailable && !auto.current) { auto.current = true; analyse(); } /* eslint-disable-next-line */ }, [data?.id, settings?.aiAvailable]);

  async function savePieces(next: Piece[]) {
    await api.patchLook(id, { pieces: next });
    await load();
  }
  async function remove() {
    if (!confirm("Remove this look? Products you saved to your wishlist are kept.")) return;
    await api.deleteLook(id);
    await refresh();
    pop();
  }

  const selected = products.filter((p) => p.selected);
  const owned = pieces.filter((p) => !p.forceShop && matchOwned(p, gitems));
  const toBuy = pieces.filter((p) => !owned.includes(p));
  const totalByCur = selected.reduce<Record<string, number>>((m, p) => ((m[p.currency] = (m[p.currency] ?? 0) + (p.price ?? 0)), m), {});
  const missing = toBuy.filter((p) => !selected.some((s) => s.pieceId === p.id)).length;

  return (
    <Overlay title="Shop the look" onBack={() => { refresh(); pop(); }} right={<button className="chip" onClick={remove}>Remove</button>}
      foot={pieces.length ? (
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="sm"><b>{owned.length}</b> you own · <b>{toBuy.length}</b> to find{missing && toBuy.length ? <span className="muted"> ({missing} not chosen yet)</span> : null}</span>
            <span className="h-l" style={{ fontSize: 20 }}>{Object.keys(totalByCur).length ? Object.entries(totalByCur).map(([c, v]) => money(v, c)).join(" + ") : "—"}</span>
          </div>
          <div className="xs muted">Estimated cost of the pieces you’ve chosen. Capsule doesn’t earn anything from these links.</div>
        </div>
      ) : undefined}
    >
      {data && (
        <div className="sec" style={{ paddingTop: 4 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <Img name={data.image} alt="Inspiration" style={{ width: 112, height: 150, objectFit: "cover", borderRadius: 14, background: "var(--stage)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="h-l" style={{ fontSize: 20 }}>{pieces.length ? `${pieces.length} pieces` : "Inspiration"}</h2>
              {data.sourceUrl && <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="xs" style={{ textDecoration: "underline", wordBreak: "break-all" }}>Original post ↗</a>}
              {!data.analysed && (
                <div style={{ marginTop: 8 }}>
                  {settings?.aiAvailable ? (
                    <button className="btn dark sm" disabled={analysing} onClick={analyse}>{analysing ? "Finding the pieces…" : "Find the pieces"}</button>
                  ) : (
                    <p className="xs muted" style={{ lineHeight: 1.5 }}>Add the pieces you see below. (With a Gemini key under Me → AI, Capsule finds them automatically.)</p>
                  )}
                </div>
              )}
              {analysing && <div className="xs muted" style={{ marginTop: 6 }}><span className="spin" /> Looking at the photo…</div>}
              {err && <div className="xs" style={{ color: "var(--danger)", marginTop: 6, lineHeight: 1.4 }}>{err}</div>}
            </div>
          </div>
        </div>
      )}

      {pieces.map((p) => (
        <PieceCard key={p.id} look={data!} piece={p} products={products.filter((x) => x.pieceId === p.id)} settings={settings} direction={direction}
          onEdit={() => setEditing(p)} onChange={async (patch) => savePieces(pieces.map((x) => (x.id === p.id ? { ...x, ...patch } : x)))} reload={load} />
      ))}

      <div className="sec" style={{ paddingBottom: 12 }}>
        <button className="btn light full" onClick={() => setEditing("new")}>＋ Add a piece{pieces.length ? "" : " you can see in the photo"}</button>
      </div>

      {editing && (
        <PieceForm
          piece={editing === "new" ? null : editing} direction={direction}
          onClose={() => setEditing(null)}
          onSave={async (np) => { await savePieces(editing === "new" ? [...pieces, np] : pieces.map((x) => (x.id === np.id ? np : x))); setEditing(null); }}
          onDelete={editing !== "new" ? async () => { await savePieces(pieces.filter((x) => x.id !== (editing as Piece).id)); setEditing(null); } : undefined}
        />
      )}
    </Overlay>
  );
}

/* ------------------------------------------------------------------ a piece */

export function PieceCard({ look, piece, products, settings, direction, onEdit, onChange, reload, alwaysSave }: {
  look: { id: string | null }; piece: Piece; products: Product[]; settings: Settings | null; direction: string;
  onEdit?: () => void; onChange?: (p: Partial<Piece>) => Promise<void>; reload: () => Promise<void>; alwaysSave?: boolean;
}) {
  const { gitems, profile, itemById, push, toast, refresh } = useStore();
  const match = useMemo(() => matchOwned(piece, gitems), [piece, gitems]);
  const ownedItem = match ? itemById[match.id] : null;
  const covered = !!match && !piece.forceShop;
  const [results, setResults] = useState<Ranked[] | null>(null);
  const [links, setLinks] = useState(() => searchLinks(piece.query, settings?.country ?? "IN"));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sort, setSort] = useState<"best" | "price" | "rating">("best");
  const [budget, setBudget] = useState("");
  const [paste, setPaste] = useState("");
  const [pasted, setPasted] = useState<Ranked | null>(null);
  const [open, setOpen] = useState<Ranked | null>(null);

  useEffect(() => { setLinks(searchLinks(piece.query, settings?.country ?? "IN")); }, [piece.query, settings?.country]);

  const ranker = useCallback((c: Candidate[]) => rankProducts(c, piece, gitems, profile, budget ? Number(budget) : null), [piece, gitems, profile, budget]);

  async function find() {
    setBusy(true); setMsg(null);
    try {
      const r = await api.shopSearch(piece.query);
      setLinks(r.links);
      if (r.error) setMsg(r.error);
      setResults(ranker(r.candidates));
      if (!r.candidates.length && !r.error) setMsg("No results came back. Try the store links below.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Search failed"); }
    setBusy(false);
  }
  async function previewLink() {
    if (!paste.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const c = await api.previewProduct(paste.trim());
      setPasted(ranker([c])[0]);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't read that page"); }
    setBusy(false);
  }
  const stored = (url: string) => products.find((p) => p.url === url);
  async function choose(c: Ranked) {
    const s = stored(c.url);
    if (s?.selected) await api.patchProduct(s.id, { selected: false });
    else await api.addProduct({ ...c, lookId: look.id, pieceId: piece.id, selected: true, saved: !!alwaysSave });
    await reload(); refresh();
  }
  async function save(c: Ranked) {
    const s = stored(c.url);
    if (s) await api.patchProduct(s.id, { saved: !s.saved });
    else await api.addProduct({ ...c, lookId: look.id, pieceId: piece.id, saved: true });
    toast(s?.saved ? "Removed from wishlist" : "Saved to wishlist");
    await reload(); refresh();
  }

  const shown = useMemo(() => {
    if (!results) return null;
    const r = [...results];
    if (sort === "price") r.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (sort === "rating") r.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return r.slice(0, 12);
  }, [results, sort]);
  const chosen = products.find((p) => p.selected);

  return (
    <div className="sec">
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: piece.colorHex, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)", flex: "none" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{piece.name}</div>
            <div className="xs muted">{piece.category} · {piece.colorName}{piece.fit ? ` · ${piece.fit}` : ""}</div>
          </div>
          {onEdit && <button className="chip" onClick={onEdit}>Edit</button>}
        </div>

        {match && ownedItem && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 14, background: covered ? "#eaf4ec" : "#f3f0eb", display: "flex", gap: 10, alignItems: "center" }}>
            <button style={{ width: 52, height: 58, borderRadius: 10, background: "#fff", border: 0, padding: 0, flex: "none" }} onClick={() => push({ t: "item", id: ownedItem.id })} aria-label={ownedItem.name}>
              <Img name={ownedItem.image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{covered ? "You already own this" : "You own something close"}</div>
              <div className="xs">{ownedItem.name} · {match.similarity}% similar — {match.why.toLowerCase()}</div>
            </div>
            <button className="chip" onClick={() => onChange?.({ forceShop: !piece.forceShop })}>{covered ? "Shop anyway" : "Use mine"}</button>
          </div>
        )}

        {!covered && (
          <div style={{ marginTop: 12 }}>
            {chosen && (
              <div style={{ padding: "8px 10px", background: "#f3f0ff", borderRadius: 12, marginBottom: 10, fontSize: 13, display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ minWidth: 0 }}><b>Chosen:</b> {chosen.title.slice(0, 48)} · {chosen.merchant}</span>
                <b>{money(chosen.price, chosen.currency)}</b>
              </div>
            )}
            {settings?.shopAvailable ? (
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button className="btn dark sm" style={{ flex: 1 }} disabled={busy} onClick={find}>{busy ? "Searching…" : results ? "Search again" : "Find matches"}</button>
                <input className="input" style={{ width: 96, height: 38 }} inputMode="numeric" placeholder="Max ₹" value={budget} onChange={(e) => setBudget(e.target.value)} aria-label="Budget" />
              </div>
            ) : (
              <div className="xs muted" style={{ marginBottom: 8, lineHeight: 1.5 }}>Live price search needs a shopping key (Me → Shopping). Meanwhile, open a search below, then paste the product link you like — Capsule reads the price and rating from the page.</div>
            )}
            {msg && <div className="xs" style={{ color: "var(--danger)", margin: "4px 0 8px", lineHeight: 1.4 }}>{msg}</div>}

            {shown && shown.length > 0 && (
              <>
                <div className="chips" style={{ padding: "0 0 8px" }}>
                  {([["best", "Best match"], ["price", "Lowest price"], ["rating", "Top rated"]] as const).map(([k, l]) => <button key={k} className={`chip ${sort === k ? "on" : ""}`} onClick={() => setSort(k)}>{l}</button>)}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {shown.map((c) => <ProductRow key={c.url} c={c} stored={stored(c.url)} onChoose={() => choose(c)} onSave={() => save(c)} onOpen={() => setOpen(c)} />)}
                </div>
              </>
            )}

            <div className="xs muted" style={{ margin: "12px 0 6px" }}>Search on</div>
            <div className="chips" style={{ padding: 0 }}>
              {links.map((l) => <a key={l.name} className="chip" href={l.url} target="_blank" rel="noopener noreferrer">{l.name} ↗</a>)}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input className="input" style={{ height: 40 }} placeholder="Paste a product link" value={paste} onChange={(e) => setPaste(e.target.value)} onKeyDown={(e) => e.key === "Enter" && previewLink()} />
              <button className="btn light sm" disabled={busy || !paste.trim()} onClick={previewLink}>Read</button>
            </div>
            {pasted && (
              <div style={{ marginTop: 8 }}>
                <ProductRow c={pasted} stored={stored(pasted.url)} onChoose={() => choose(pasted)} onSave={() => save(pasted)} onOpen={() => setOpen(pasted)} />
              </div>
            )}
            {products.filter((p) => !(shown ?? []).some((c) => c.url === p.url) && p.url !== pasted?.url && (p.selected || p.saved)).map((p) => (
              <div key={p.id} style={{ marginTop: 8 }}>
                <ProductRow c={{ ...p, relevance: 1, tier: "similar", colourMatch: false, palette: { delta: 0, text: null }, unlocks: 0 }} stored={p} onChoose={() => choose({ ...p, relevance: 1, tier: "similar", colourMatch: false, palette: { delta: 0, text: null }, unlocks: 0 })} onSave={() => save({ ...p, relevance: 1, tier: "similar", colourMatch: false, palette: { delta: 0, text: null }, unlocks: 0 })} onOpen={() => setOpen({ ...p, relevance: 1, tier: "similar", colourMatch: false, palette: { delta: 0, text: null }, unlocks: 0 })} />
              </div>
            ))}
          </div>
        )}
      </div>
      {open && <ProductSheet c={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ProductRow({ c, stored, onChoose, onSave, onOpen }: { c: Ranked; stored?: Product; onChoose: () => void; onSave: () => void; onOpen: () => void }) {
  const drop = stored?.firstPrice && c.price != null && c.price < stored.firstPrice ? Math.round((1 - c.price / stored.firstPrice) * 100) : 0;
  const tone = c.trust.level === "established" ? "ai" : c.trust.level === "caution" ? "dup" : "guess";
  return (
    <div style={{ display: "flex", gap: 10, padding: 8, border: `1px solid ${stored?.selected ? "var(--ink)" : "var(--line)"}`, borderRadius: 14, background: "#fff" }}>
      <button onClick={onOpen} style={{ width: 74, height: 90, borderRadius: 10, background: "var(--tile)", flex: "none", overflow: "hidden", padding: 0, border: 0 }} aria-label="Details">
        {c.imageUrl ? <img src={c.imageUrl} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.title}</div>
        <div className="xs muted" style={{ margin: "2px 0 4px" }}>{c.merchant}{c.rating != null ? ` · ★ ${c.rating.toFixed(1)}${c.reviews != null ? ` (${c.reviews.toLocaleString()})` : ""}` : " · no rating"}</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
          <span className={`pill ${tone}`}>{c.trust.label}</span>
          {c.tier === "best" && <span className="pill ai">Best match</span>}
          {c.tier === "budget" && <span className="pill ai">Budget pick</span>}
          {c.palette.delta >= 6 && <span className="pill ai">In your palette</span>}
          {c.palette.delta < 0 && <span className="pill guess">Off your palette</span>}
          {c.unlocks > 0 && <span className="pill ai">+{c.unlocks} outfit{c.unlocks > 1 ? "s" : ""}</span>}
          {drop > 0 && <span className="pill ai">↓ {drop}% since saved</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <b style={{ fontSize: 15 }}>{money(c.price, c.currency)}</b>
          {c.oldPrice != null && c.oldPrice > (c.price ?? 0) && <s className="xs muted">{money(c.oldPrice, c.currency)}</s>}
          <span style={{ flex: 1 }} />
          <button className="chip" style={{ height: 30, padding: "0 10px" }} aria-label={stored?.saved ? "Remove from wishlist" : "Save to wishlist"} onClick={onSave}>{stored?.saved ? "♥" : "♡"}</button>
          <button className={`chip ${stored?.selected ? "on" : ""}`} style={{ height: 30, padding: "0 12px" }} onClick={onChoose}>{stored?.selected ? "Chosen ✓" : "Choose"}</button>
        </div>
      </div>
    </div>
  );
}

function ProductSheet({ c, onClose }: { c: Ranked; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <div style={{ display: "flex", gap: 12 }}>
        {c.imageUrl && <img src={c.imageUrl} alt="" referrerPolicy="no-referrer" style={{ width: 96, height: 120, objectFit: "cover", borderRadius: 12 }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{c.title}</div>
          <div className="sm muted">{c.merchant}</div>
          <div style={{ marginTop: 6 }}><b className="h-l" style={{ fontSize: 22 }}>{money(c.price, c.currency)}</b> {c.oldPrice != null && c.oldPrice > (c.price ?? 0) && <s className="sm muted">{money(c.oldPrice, c.currency)}</s>}</div>
          {c.rating != null && <div className="sm">★ {c.rating.toFixed(1)}{c.reviews != null ? ` · ${c.reviews.toLocaleString()} reviews` : ""}</div>}
        </div>
      </div>
      <div className="sec" style={{ padding: "14px 0 0" }}>
        <h3>About this store</h3>
        <div className="sm" style={{ lineHeight: 1.5 }}><b>{c.trust.label}.</b>{c.trust.notes.map((n) => <div key={n}>· {n}</div>)}</div>
        {(c.palette.text || c.unlocks > 0) && (
          <>
            <h3 style={{ marginTop: 14 }}>For you</h3>
            <div className="sm" style={{ lineHeight: 1.5 }}>
              {c.palette.text && <div>· {c.palette.text}.</div>}
              {c.unlocks > 0 && <div>· Would add about {c.unlocks} good outfit{c.unlocks > 1 ? "s" : ""} to what you already own.</div>}
            </div>
          </>
        )}
        {c.delivery && <div className="xs muted" style={{ marginTop: 10 }}>{c.delivery}</div>}
      </div>
      <a className="btn dark full" style={{ marginTop: 14, textDecoration: "none" }} href={c.url} target="_blank" rel="noopener noreferrer">Open on {c.merchant || "the store"} ↗</a>
      <p className="xs muted" style={{ textAlign: "center", marginTop: 8 }}>Check size, returns and the seller before you buy. Prices change.</p>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ add / edit a piece by hand */

function PieceForm({ piece, direction, onClose, onSave, onDelete }: { piece: Piece | null; direction: string; onClose: () => void; onSave: (p: Piece) => Promise<void>; onDelete?: () => Promise<void> }) {
  const [p, setP] = useState<Piece>(piece ?? { id: uid(), name: "", category: "Tops", colorName: "", colorHex: "#6b6b3a", pattern: "solid", fit: "", query: "" });
  const [queryTouched, setQueryTouched] = useState(!!piece?.query);
  const set = (x: Partial<Piece>) => setP((cur) => {
    const next = { ...cur, ...x };
    if (!queryTouched && !("query" in x)) next.query = buildQuery(next, direction);
    return next;
  });
  return (
    <Sheet onClose={onClose}>
      <h2 className="h-l" style={{ marginBottom: 12 }}>{piece ? "Edit piece" : "Add a piece"}</h2>
      <div style={{ display: "grid", gap: 12 }}>
        <div><label className="f">What is it?</label><input autoFocus className="input" placeholder="e.g. Olive overshirt" value={p.name} onChange={(e) => set({ name: e.target.value })} /></div>
        <div className="fgrid">
          <div><label className="f">Category</label><select className="input" value={p.category} onChange={(e) => set({ category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="f">Fit</label><select className="input" value={p.fit} onChange={(e) => set({ fit: e.target.value })}>{FITS.map((c) => <option key={c} value={c}>{c || "—"}</option>)}</select></div>
        </div>
        <div>
          <label className="f">Colour</label>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="swatch" style={{ background: p.colorHex }}><input type="color" value={p.colorHex} onChange={(e) => set({ colorHex: e.target.value, colorName: nameColor(e.target.value) })} aria-label="Pick colour" /></div>
            <input className="input" placeholder="Colour name" value={p.colorName} onChange={(e) => set({ colorName: e.target.value })} />
          </div>
        </div>
        <div><label className="f">Search words <span className="muted">(what you’d type in a shop)</span></label><input className="input" value={p.query} onChange={(e) => { setQueryTouched(true); setP({ ...p, query: e.target.value }); }} /></div>
        <button className="btn dark full" disabled={!p.name.trim()} onClick={() => onSave({ ...p, colorName: p.colorName || nameColor(p.colorHex), query: p.query || buildQuery(p, direction) })}>Save piece</button>
        {onDelete && <button className="btn danger full" onClick={onDelete}>Remove this piece</button>}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ Shop section of the closet: looks + wishlist */

export function ShopSection() {
  const { looks, wishlist, push, refresh, toast } = useStore();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  async function refreshOne(p: Product) {
    setBusy(p.id);
    try { await api.refreshProduct(p.id); await refresh(); toast("Price updated"); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't refresh"); }
    setBusy(null);
  }
  return (
    <div style={{ paddingTop: 12 }}>
      <div className="sec" style={{ paddingTop: 0 }}><h3>Looks to shop</h3></div>
      <div className="grid3" style={{ paddingTop: 0 }}>
        <button className="tile" onClick={() => setSheet(true)}>
          <div className="img" style={{ border: "1.5px dashed #cfc8bc", boxShadow: "none", background: "transparent", color: "var(--muted)", fontSize: 13, textAlign: "center" }}><span>＋<br />New look</span></div>
          <div className="b">Shop a look</div><div className="t">From a photo</div>
        </button>
        {looks.map((l) => (
          <button className="tile" key={l.id} onClick={() => push({ t: "look", id: l.id })}>
            <div className="img" style={{ overflow: "hidden" }}><Img name={l.image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "none" }} /></div>
            <div className="b">{l.pieces.length ? `${l.pieces.length} pieces` : "Not analysed"}</div>
            <div className="t">{new Date(l.createdAt.replace(" ", "T") + "Z").toLocaleDateString(undefined, { day: "numeric", month: "short" })}</div>
          </button>
        ))}
      </div>
      <div className="sec" style={{ paddingTop: 4 }}><h3>Wishlist {wishlist.length ? `· ${wishlist.length}` : ""}</h3></div>
      {wishlist.length === 0 ? (
        <div className="empty sm" style={{ paddingTop: 8 }}>Tap ♡ on any product to keep it here.</div>
      ) : (
        <div style={{ display: "grid", gap: 8, padding: "0 20px 24px" }}>
          {wishlist.map((p) => {
            const drop = p.firstPrice && p.price != null && p.price < p.firstPrice ? Math.round((1 - p.price / p.firstPrice) * 100) : 0;
            return (
              <div key={p.id} className="card" style={{ padding: 8, display: "flex", gap: 10 }}>
                <div style={{ width: 64, height: 76, borderRadius: 10, background: "var(--tile)", overflow: "hidden", flex: "none" }}>{p.imageUrl && <img src={p.imageUrl} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.title}</div>
                  <div className="xs muted">{p.merchant} · <span className={`pill ${p.trust.level === "established" ? "ai" : p.trust.level === "caution" ? "dup" : "guess"}`}>{p.trust.label}</span></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <b>{money(p.price, p.currency)}</b>{drop > 0 && <span className="pill ai">↓ {drop}%</span>}
                    <span style={{ flex: 1 }} />
                    {p.source === "pasted" && <button className="chip" style={{ height: 28 }} disabled={busy === p.id} onClick={() => refreshOne(p)}>↻</button>}
                    <a className="chip" style={{ height: 28 }} href={p.url} target="_blank" rel="noopener noreferrer">Open ↗</a>
                    <button className="chip" style={{ height: 28 }} aria-label="Remove" onClick={async () => { await api.patchProduct(p.id, { saved: false }); await refresh(); }}>✕</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {sheet && <ShopLookSheet onClose={() => setSheet(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ Me tab: shopping settings */

export function ShoppingSettings() {
  const { toast } = useStore();
  const [st, setSt] = useState<Settings | null>(null);
  useEffect(() => { api.settings().then(setSt).catch(() => {}); }, []);
  if (!st) return null;
  async function saveCountry(c: string) { await api.saveSettings({ country: c }); setSt(await api.settings()); toast("Region saved"); }
  return (
    <div className="sec">
      <h3>Shopping</h3>
      <div className="card" style={{ padding: 14 }}>
        <label className="f">Where do you shop?</label>
        <select className="input" value={st.country} onChange={(e) => saveCountry(e.target.value)}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 0 6px" }}>
          <b style={{ fontSize: 15 }}>Live price search</b>
          <span className={`pill ${st.shopAvailable ? "ai" : "guess"}`}>{st.shopAvailable ? "Key saved" : "Not connected"}</span>
        </div>
        <p className="xs muted" style={{ lineHeight: 1.5, marginBottom: 10 }}>
          Optional. With a <a href="https://serpapi.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>SerpApi</a> key Capsule can pull Google Shopping results (price, rating, reviews, store) for each piece. Without one you still get store-search links and “paste a product link”. The key stays on this computer; searches are billed by SerpApi per their plan.
        </p>
        {st.shopKeyFromEnv ? <div className="xs muted">Key is set via the SERPAPI_KEY environment variable.</div> : (
          <SecretKey
            isSet={st.shopAvailable}
            placeholder="Paste your SerpApi key"
            noun="shopping key"
            onSave={async (v) => { await api.saveSettings({ serpApiKey: v }); setSt(await api.settings()); toast("Shopping key saved on this computer"); }}
            onRemove={async () => { await api.saveSettings({ serpApiKey: "" }); setSt(await api.settings()); toast("Shopping key removed"); }}
          />
        )}
      </div>
    </div>
  );
}

