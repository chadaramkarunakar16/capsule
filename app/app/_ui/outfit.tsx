"use client";
import { useState } from "react";
import { api, img } from "@/lib/api";
import { CAT_ORDER } from "@/lib/types";
import { AddToBoard } from "./boards";
import { PickItems } from "./pick";
import { outfitFit } from "@/lib/style/score";
import { FitCard } from "./style";
import { Overlay, today, Img } from "./ui";
import { useStore } from "./store";

const OCCASIONS = ["Everyday", "Work", "Date", "Party", "Travel", "Workout"];
const TARGET: Record<string, number> = { Everyday: 1.5, Work: 2.6, Date: 2.3, Party: 2.4, Travel: 1.5, Workout: 1 };

/** Manual outfit builder: pick pieces from the closet, preview the look, save. */
export function OutfitBuilder({ outfitId, itemIds: initial }: { outfitId?: string; itemIds?: string[] }) {
  const { outfits, itemById, pop, push, refresh, toast, profile } = useStore();
  const existing = outfitId ? outfits.find((o) => o.id === outfitId) : undefined;
  const [ids, setIds] = useState<string[]>(existing?.itemIds ?? initial ?? []);
  const [name, setName] = useState(existing?.name ?? "");
  const [occasion, setOccasion] = useState(existing?.occasion ?? "");
  const [picking, setPicking] = useState(!existing && !(initial && initial.length));
  const [board, setBoard] = useState(false);
  const [saving, setSaving] = useState(false);

  const chosen = ids.map((i) => itemById[i]).filter(Boolean).sort((a, b) => (CAT_ORDER[a.category] ?? 9) - (CAT_ORDER[b.category] ?? 9));
  const fit = chosen.length ? outfitFit(chosen, profile, occasion ? TARGET[occasion] : undefined) : null;
  const toggle = (id: string) => setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function save(wearToday = false) {
    if (!ids.length) return toast("Add at least one piece");
    setSaving(true);
    try {
      const body = { name: name.trim() || (occasion ? `${occasion} look` : "Untitled look"), occasion, itemIds: chosen.map((c) => c.id) };
      const o = existing ? await api.updateOutfit(existing.id, body) : await api.createOutfit(body);
      if (wearToday) await api.logWear({ date: today(), outfitId: o.id });
      await refresh();
      toast(wearToday ? "Saved & logged for today" : "Outfit saved");
      pop();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save");
    }
    setSaving(false);
  }
  async function del() {
    if (!existing || !confirm("Delete this outfit?")) return;
    await api.deleteOutfit(existing.id);
    await refresh();
    pop();
  }

  return (
    <Overlay
      title={existing ? "Edit outfit" : "New outfit"}
      onBack={pop}
      right={<>{chosen.length > 0 && <button className="chip" onClick={() => push({ t: "tryon", itemIds: chosen.map((c) => c.id), name: name || undefined })}>On me</button>}{existing && <button className="chip" onClick={() => setBoard(true)}>Save to board</button>}</>}
      foot={
        <>
          <button className="btn light" disabled={saving || !ids.length} onClick={() => save(true)}>Wore it today</button>
          <button className="btn dark" style={{ flex: 1 }} disabled={saving || !ids.length} onClick={() => save(false)}>{existing ? "Save changes" : "Save outfit"}</button>
        </>
      }
    >
      <div className="stage">
        {chosen.length === 0 ? (
          <div className="stage-empty">Pick pieces to build your look</div>
        ) : (
          <div className="stage-grid">
            {chosen.map((c) => (
              <div className="slot" key={c.id}>
                <Img name={c.image} alt={c.name} />
                <button className="x" aria-label={`Remove ${c.name}`} onClick={() => toggle(c.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {fit && <div className="sec" style={{ paddingTop: 14 }}><FitCard fit={fit} title="How this look suits you" /></div>}
      <div className="sec" style={{ paddingTop: 14 }}>
        <button className="btn light full" onClick={() => setPicking(true)}>{chosen.length ? "Add or swap pieces" : "Choose pieces"}</button>
      </div>
      <div className="sec">
        <label className="f">Name</label>
        <input className="input" placeholder="e.g. Chic Brunch" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="chips" style={{ padding: "10px 0 0" }}>
          {OCCASIONS.map((o) => (
            <button key={o} className={`chip ${occasion === o ? "on" : ""}`} onClick={() => setOccasion(occasion === o ? "" : o)}>{o}</button>
          ))}
        </div>
      </div>
      {existing && (
        <div className="sec" style={{ paddingBottom: 12 }}>
          <button className="btn danger full" onClick={del}>Delete outfit</button>
        </div>
      )}
      {picking && (
        <div className="overlay" style={{ zIndex: 50 }}>
          <div className="ov-hdr"><div className="grow">Choose pieces</div><button className="chip on" onClick={() => setPicking(false)}>Done ({ids.length})</button></div>
          <div className="ov-body"><PickItems selected={ids} onToggle={toggle} /></div>
        </div>
      )}
      {board && existing && <AddToBoard kind="outfit" refId={existing.id} onClose={() => setBoard(false)} />}
    </Overlay>
  );
}

