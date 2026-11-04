"use client";
import { useState } from "react";
import { api, img } from "@/lib/api";
import { CATEGORIES, type Item } from "@/lib/types";
import { AddToBoard } from "./boards";
import { itemFit } from "@/lib/style/score";
import { FitCard } from "./style";
import { Overlay, fmtDate, money, today, Img } from "./ui";
import { useStore } from "./store";

const FITS = ["", "slim", "fitted", "regular", "relaxed", "oversized", "straight", "wide", "cropped"];
const PATTERNS = ["solid", "striped", "checked", "floral", "graphic", "textured", "other"];
const FORMAL = ["", "Casual", "Smart-casual", "Dressy"];
const NECKLINES = ["", "crew", "v-neck", "scoop", "boat", "collared", "turtleneck", "off-shoulder"];
const RISES = ["", "low", "mid", "high"];
const LENGTHS = ["", "cropped", "regular", "long"];

export function ItemDetail({ id }: { id: string }) {
  const { itemById, pop, push, refresh, toast, profile } = useStore();
  const item = itemById[id];
  const [f, setF] = useState<Item | null>(item ?? null);
  const [dirty, setDirty] = useState(false);
  const [board, setBoard] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!item || !f) return <Overlay title="Item" onBack={pop}><div className="empty">This item no longer exists.</div></Overlay>;

  const set = (p: Partial<Item>) => { setF({ ...f, ...p }); setDirty(true); };
  const fit = itemFit(f, profile);
  const setAttr = (k: string, v: string) => set({ attrs: { ...f.attrs, [k]: v || undefined } });
  const attr = (k: string) => (typeof f.attrs?.[k] === "string" ? (f.attrs[k] as string) : "");
  const price = f.price ?? null;
  const cpw = price != null && item.wears > 0 ? price / item.wears : null;

  async function save() {
    setBusy(true);
    try {
      const { name, brand, category, colorName, colorHex, pattern, fit, formality, season, size, price, purchaseDate, notes } = f!;
      await api.updateItem(id, { name, brand, category, colorName, colorHex, pattern, fit, formality, season, size, price: price ?? ("" as never), purchaseDate: purchaseDate ?? ("" as never), notes, attrs: f!.attrs });
      await refresh();
      setDirty(false);
      toast("Saved");
    } catch (e) { toast(e instanceof Error ? e.message : "Could not save"); }
    setBusy(false);
  }
  async function wearToday() {
    await api.logWear({ date: today(), itemIds: [id] });
    await refresh();
    toast("Logged as worn today");
  }
  async function del() {
    if (!confirm(`Delete “${item.name || "this item"}”? It will also be removed from outfits and boards.`)) return;
    await api.deleteItem(id);
    await refresh();
    pop();
  }

  return (
    <Overlay
      title={item.name || "Item"}
      onBack={pop}
      right={<button className="chip" onClick={del}>Delete</button>}
      foot={dirty ? <button className="btn dark full" disabled={busy} onClick={save}>Save changes</button> : undefined}
    >
      <div className="hero"><Img name={item.image} alt={item.name} /></div>
      <div className="sec" style={{ paddingTop: 14 }}>
        <div className="stat">
          <div><b>{item.wears}</b><span className="xs muted">times worn</span></div>
          <div><b>{cpw != null ? money(cpw) : "—"}</b><span className="xs muted">cost per wear</span></div>
          <div><b style={{ fontSize: 15, paddingTop: 5 }}>{item.lastWorn ? fmtDate(item.lastWorn) : "Never"}</b><span className="xs muted">last worn</span></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn dark sm" onClick={wearToday}>Wore it today</button>
          <button className="btn light sm" onClick={() => push({ t: "outfit", itemIds: [id] })}>Build an outfit</button>
          <button className="btn light sm" onClick={() => push({ t: "tryon", itemIds: [id], name: item.name || undefined })}>Try on me</button>
          <button className="btn light sm" onClick={() => setBoard(true)}>Save to board</button>
        </div>
      </div>
      <div className="sec"><FitCard fit={fit} /></div>
      <div className="sec">
        <h3>Details {!item.aiTagged && <span className="xs" style={{ textTransform: "none", letterSpacing: 0 }}>· tags entered manually</span>}</h3>
        <div style={{ display: "grid", gap: 12 }}>
          <div><label className="f">Name</label><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="fgrid">
            <div><label className="f">Brand</label><input className="input" value={f.brand} onChange={(e) => set({ brand: e.target.value })} /></div>
            <div><label className="f">Category</label>
              <select className="input" value={f.category} onChange={(e) => set({ category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div>
            <label className="f">Colour</label>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="swatch" style={{ background: f.colorHex }}><input type="color" value={f.colorHex} onChange={(e) => set({ colorHex: e.target.value })} aria-label="Pick colour" /></div>
              <input className="input" value={f.colorName} placeholder="Colour name" onChange={(e) => set({ colorName: e.target.value })} />
            </div>
          </div>
          <div className="fgrid">
            <div><label className="f">Fit</label>
              <select className="input" value={f.fit} onChange={(e) => set({ fit: e.target.value })}>{FITS.map((c) => <option key={c} value={c}>{c || "—"}</option>)}</select></div>
            <div><label className="f">Pattern</label>
              <select className="input" value={f.pattern} onChange={(e) => set({ pattern: e.target.value })}>{PATTERNS.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className="f">Formality</label>
              <select className="input" value={f.formality} onChange={(e) => set({ formality: Number(e.target.value) })}>{[1, 2, 3].map((n) => <option key={n} value={n}>{FORMAL[n]}</option>)}</select></div>
            <div><label className="f">Season</label>
              <select className="input" value={f.season} onChange={(e) => set({ season: e.target.value })}><option value="all">All seasons</option><option value="warm">Warm</option><option value="cool">Cool</option></select></div>
            <div><label className="f">Size</label><input className="input" value={f.size} placeholder="e.g. M / 32" onChange={(e) => set({ size: e.target.value })} /></div>
            <div><label className="f">Price paid (₹)</label><input className="input" inputMode="decimal" value={f.price ?? ""} onChange={(e) => set({ price: e.target.value === "" ? null : Number(e.target.value) || 0 })} /></div>
          </div>
          {(f.category === "Tops" || f.category === "Dresses") && (
            <div><label className="f">Neckline <span className="muted">(used for face-shape advice)</span></label>
              <select className="input" value={attr("neckline")} onChange={(e) => setAttr("neckline", e.target.value)}>{NECKLINES.map((c) => <option key={c} value={c}>{c || "—"}</option>)}</select></div>
          )}
          {(f.category === "Bottoms" || f.category === "Dresses" || f.category === "Tops" || f.category === "Outerwear") && (
            <div className="fgrid">
              {f.category === "Bottoms" && <div><label className="f">Rise</label>
                <select className="input" value={attr("rise")} onChange={(e) => setAttr("rise", e.target.value)}>{RISES.map((c) => <option key={c} value={c}>{c || "—"}</option>)}</select></div>}
              <div><label className="f">Length</label>
                <select className="input" value={attr("length")} onChange={(e) => setAttr("length", e.target.value)}>{LENGTHS.map((c) => <option key={c} value={c}>{c || "—"}</option>)}</select></div>
            </div>
          )}
          <div><label className="f">Purchase date</label><input type="date" className="input" value={f.purchaseDate ?? ""} onChange={(e) => set({ purchaseDate: e.target.value || null })} /></div>
          <div><label className="f">Notes</label><textarea className="input" value={f.notes} placeholder="Care, where you bought it, how it fits…" onChange={(e) => set({ notes: e.target.value })} /></div>
        </div>
      </div>
      <div className="sec" style={{ paddingBottom: 8 }}>
        <button className="btn danger full" onClick={del}>Delete item</button>
      </div>
      {board && <AddToBoard kind="item" refId={id} onClose={() => setBoard(false)} />}
    </Overlay>
  );
}
