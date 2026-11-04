"use client";
import { useEffect, useMemo, useState } from "react";
import { api, img } from "@/lib/api";
import { GOALS, TAG_TARGET, buildCapsule, coverage, gapSuggestions, planDays, quotaTotal, quotasFor, redundancy, tripDates, type CapsuleConfig, type Day, type DayTag, type GoalKey } from "@/lib/style/capsule";
import { generate, type GItem, type Weather } from "@/lib/style/generate";
import { forecast, loadLoc } from "@/lib/weather";
import type { SavedCapsule } from "@/lib/types";
import { PieceCard } from "./shop";
import { PickItems } from "./pick";
import { Collage, Overlay, Sheet, fmtDate, iso, today, Img } from "./ui";
import { useStore } from "./store";

const CLIMATES: Record<string, { label: string; temp: number }> = { cold: { label: "Cold · ~6°C", temp: 6 }, cool: { label: "Cool · ~14°C", temp: 14 }, mild: { label: "Mild · ~21°C", temp: 21 }, hot: { label: "Hot · ~30°C", temp: 30 } };
const TAGS: DayTag[] = ["casual", "smart", "dressy"];
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return iso(d); };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------------ Plans list */

export function PlansSection() {
  const { capsules, push, gitems, itemById } = useStore();
  const ready = (gitems.some((i) => i.category === "Tops") && gitems.some((i) => i.category === "Bottoms")) || gitems.some((i) => i.category === "Dresses");
  const starters: { label: string; blurb: string; kind: "trip" | "capsule"; goal: GoalKey }[] = [
    { label: "Plan a trip", blurb: "Packing list + an outfit for every day", kind: "trip", goal: "trip" },
    { label: "Work week capsule", blurb: "5 polished days from a few pieces", kind: "capsule", goal: "work" },
    { label: "Minimal wardrobe", blurb: "Your best 30 pieces, all year", kind: "capsule", goal: "minimal" },
  ];
  return (
    <div style={{ paddingTop: 10 }}>
      {!ready && <div className="card empty sm" style={{ margin: "8px 20px", padding: 20 }}>Add at least a few tops and bottoms (or a dress) to start planning capsules and trips.</div>}
      <div className="sec" style={{ paddingTop: 6 }}><h3>Start a plan</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {starters.map((s) => (
            <button key={s.label} className="opt" style={{ margin: 0, opacity: ready ? 1 : 0.5 }} disabled={!ready} onClick={() => push({ t: "capsule", kind: s.kind, goal: s.goal })}>
              <span><b>{s.label}</b><span className="xs muted">{s.blurb}</span></span>
            </button>
          ))}
          <button className="opt" style={{ margin: 0, opacity: ready ? 1 : 0.5 }} disabled={!ready} onClick={() => push({ t: "capsule", kind: "capsule", goal: "custom" })}>
            <span><b>Custom capsule</b><span className="xs muted">Pick how many pieces</span></span>
          </button>
        </div>
      </div>
      {capsules.length > 0 && (
        <div className="sec"><h3>Your plans</h3>
          <div className="grid2" style={{ padding: 0 }}>
            {capsules.map((c) => (
              <button key={c.id} className="ocard" onClick={() => push({ t: "capsule", id: c.id })}>
                <Collage items={c.itemIds.map((i) => itemById[i]).filter(Boolean).slice(0, 4)} />
                <div className="n">{c.name}</div>
                <div className="s">{c.kind === "trip" ? `Trip · ${c.config.trip?.days ?? c.days.length} days · ` : ""}{c.itemIds.length} pieces</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ builder + viewer (one overlay) */

type Draft = {
  goal: GoalKey; name: string; destination: string; start: string; days: number; climate: string; rain: boolean; useForecast: boolean; size: number; pinned: string[];
};

export function CapsuleScreen({ id, kind, goal }: { id?: string; kind?: "capsule" | "trip"; goal?: string }) {
  const { capsules, pop } = useStore();
  const saved = id ? capsules.find((c) => c.id === id) : undefined;
  if (id && !saved) return <Overlay title="Capsule" onBack={pop}><div className="empty">This plan no longer exists.</div></Overlay>;
  return saved ? <CapsuleView c={saved} /> : <CapsuleBuilder kind={kind ?? "capsule"} goal={(goal as GoalKey) ?? (kind === "trip" ? "trip" : "work")} />;
}

function CapsuleBuilder({ kind, goal }: { kind: "capsule" | "trip"; goal: GoalKey }) {
  const { gitems, profile, taste, pop, push, refresh, toast } = useStore();
  const [d, setD] = useState<Draft>({ goal, name: "", destination: "", start: tomorrow(), days: 5, climate: "mild", rain: false, useForecast: false, size: 14, pinned: [] });
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState(false);
  const loc = typeof window !== "undefined" ? loadLoc() : null;
  const isTrip = d.goal === "trip";
  const set = (x: Partial<Draft>) => setD((cur) => ({ ...cur, ...x }));
  const g = GOALS.find((x) => x.key === d.goal)!;

  async function build() {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const days = isTrip ? Math.max(1, Math.min(21, d.days)) : d.goal === "work" ? 5 : 7;
      const dates = tripDates(isTrip ? d.start : today(), days);
      const base: Weather = { temp: CLIMATES[d.climate].temp, rain: d.rain };
      let perDay: (Weather | null)[] = dates.map(() => base);
      if (isTrip && d.useForecast && loc) {
        perDay = await Promise.all(dates.map(async (dt) => {
          try { const w = await forecast(loc, dt); return { temp: w.temp, rain: w.rain }; } catch { return base; }
        }));
      }
      const avgTemp = perDay.reduce((a, w) => a + (w?.temp ?? base.temp), 0) / perDay.length;
      const weather: Weather = { temp: avgTemp, rain: perDay.some((w) => w?.rain) };
      const quota = quotasFor(d.goal, { days, size: d.size });
      const name = d.name.trim() || (isTrip ? `${d.destination.trim() || "Trip"} · ${days} days` : g.label);
      const cfg: CapsuleConfig = { goal: d.goal, name, quota, target: g.target, weather: isTrip ? weather : null, pinned: d.pinned, excluded: [] };
      const r = buildCapsule(gitems, profile, taste, cfg);
      if (!r.ids.length) { toast("Couldn't build a capsule from this closet yet"); setBusy(false); return; }
      const pieces = gitems.filter((i) => r.ids.includes(i.id));
      const tags: DayTag[] = dates.map((_, k) => (d.goal === "work" ? "smart" : d.goal === "college" ? "casual" : isTrip ? (k === Math.floor(days / 2) && days >= 4 ? "smart" : "casual") : k % 3 === 2 ? "smart" : "casual"));
      const plan = planDays(pieces, profile, taste, dates.map((date, k) => ({ date, tag: tags[k], weather: perDay[k] })));
      const created = await api.createCapsule({
        kind: isTrip ? "trip" : "capsule", name, itemIds: r.ids, days: plan,
        config: { ...cfg, ...(isTrip ? { trip: { destination: d.destination.trim(), start: d.start, days, climate: d.climate } } : {}) },
      });
      await refresh();
      pop();
      push({ t: "capsule", id: created.id });
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't build that"); }
    setBusy(false);
  }

  const q = quotasFor(d.goal, { days: d.days, size: d.size });
  return (
    <Overlay title={isTrip ? "Plan a trip" : "New capsule"} onBack={pop} foot={<button className="btn dark full" disabled={busy} onClick={build}>{busy ? "Choosing your pieces…" : "Build it"}</button>}>
      <div className="sec" style={{ paddingTop: 8, display: "grid", gap: 16 }}>
        <div>
          <label className="f">Goal</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {GOALS.filter((x) => kind === "trip" ? x.key === "trip" : x.key !== "trip").map((x) => <button key={x.key} className={`chip ${d.goal === x.key ? "on" : ""}`} onClick={() => set({ goal: x.key })}>{x.label}</button>)}
          </div>
          <p className="xs muted" style={{ marginTop: 6 }}>{g.blurb}</p>
        </div>
        <div><label className="f">Name</label><input className="input" placeholder={isTrip ? "e.g. London in November" : g.label} value={d.name} onChange={(e) => set({ name: e.target.value })} /></div>
        {isTrip && (
          <>
            <div><label className="f">Where to?</label><input className="input" placeholder="Destination (optional)" value={d.destination} onChange={(e) => set({ destination: e.target.value })} /></div>
            <div className="fgrid">
              <div><label className="f">Starts</label><input type="date" className="input" value={d.start} onChange={(e) => set({ start: e.target.value })} /></div>
              <div><label className="f">Days</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="chip" style={{ width: 44, justifyContent: "center" }} onClick={() => set({ days: Math.max(1, d.days - 1) })} aria-label="Fewer days">−</button>
                  <input className="input" style={{ textAlign: "center" }} inputMode="numeric" value={d.days} onChange={(e) => set({ days: Math.max(1, Math.min(21, Number(e.target.value) || 1)) })} />
                  <button className="chip" style={{ width: 44, justifyContent: "center" }} onClick={() => set({ days: Math.min(21, d.days + 1) })} aria-label="More days">+</button>
                </div>
              </div>
            </div>
            <div>
              <label className="f">Weather</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(CLIMATES).map(([k, v]) => <button key={k} className={`chip ${d.climate === k ? "on" : ""}`} onClick={() => set({ climate: k })}>{v.label}</button>)}
                <button className={`chip ${d.rain ? "on" : ""}`} onClick={() => set({ rain: !d.rain })}>☂ Rain likely</button>
              </div>
              {loc && <label className="job" style={{ marginTop: 6, cursor: "pointer" }}><input type="checkbox" checked={d.useForecast} onChange={(e) => set({ useForecast: e.target.checked })} /><span>Use the forecast for {loc.name} where available <span className="muted xs">(next 7 days only)</span></span></label>}
            </div>
          </>
        )}
        {d.goal === "custom" && (
          <div><label className="f">How many pieces? <b style={{ color: "var(--ink)" }}>{quotaTotal(q)}</b></label><input type="range" min={6} max={36} value={d.size} onChange={(e) => set({ size: Number(e.target.value) })} style={{ width: "100%", accentColor: "var(--ink)" }} /></div>
        )}
        <div>
          <label className="f">Must include <span className="muted">(optional)</span></label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className="chip" onClick={() => setPick(true)}>＋ Choose pieces</button>
            {d.pinned.map((id) => <span key={id} className="chip on">{gitems.find((i) => i.id === id)?.name}</span>)}
          </div>
        </div>
        <div className="card" style={{ padding: 12, fontSize: 13, lineHeight: 1.5 }}>
          Capsule picks about <b>{quotaTotal(q)}</b> pieces from your closet — {Object.entries(q).filter(([, n]) => n).map(([c, n]) => `${n} ${c.toLowerCase()}`).join(", ")} — chosen so they mix and match as many good outfits as possible, in colours that suit you.
        </div>
      </div>
      {pick && (
        <div className="overlay" style={{ zIndex: 50 }}>
          <div className="ov-hdr"><div className="grow">Must-include pieces</div><button className="chip on" onClick={() => setPick(false)}>Done ({d.pinned.length})</button></div>
          <div className="ov-body"><PickItems selected={d.pinned} onToggle={(id) => set({ pinned: d.pinned.includes(id) ? d.pinned.filter((x) => x !== id) : [...d.pinned, id] })} /></div>
        </div>
      )}
    </Overlay>
  );
}

function CapsuleView({ c }: { c: SavedCapsule }) {
  const { gitems, itemById, profile, taste, pop, push, refresh, toast } = useStore();
  const [tab, setTab] = useState<"pieces" | "days" | "pack">(c.kind === "trip" ? "days" : "pieces");
  const [sheetItem, setSheetItem] = useState<GItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const pieces = useMemo(() => c.itemIds.map((i) => gitems.find((g) => g.id === i)).filter((g): g is GItem => !!g), [c.itemIds, gitems]);
  const trip = c.kind === "trip";
  const cfg = c.config;
  const stats = useMemo(() => buildStats(pieces, profile, cfg), [pieces, profile, cfg]);

  async function rebuild(patch: Partial<CapsuleConfig>) {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 20));
    const next: CapsuleConfig = { ...cfg, ...patch };
    const r = buildCapsule(gitems, profile, taste, next);
    const ps = gitems.filter((i) => r.ids.includes(i.id));
    const keepTags = c.days.map((dd) => ({ date: dd.date, tag: dd.tag, weather: dd.weather }));
    const plan = planDays(ps, profile, taste, keepTags);
    await api.patchCapsule(c.id, { config: { ...c.config, ...next }, itemIds: r.ids, days: plan });
    await refresh();
    setBusy(false);
  }
  async function setDay(k: number, patch: Partial<Day>) {
    await api.patchCapsule(c.id, { days: c.days.map((dd, j) => (j === k ? { ...dd, ...patch } : dd)) });
    await refresh();
  }
  /** next-best look for one day, from this capsule's pieces only */
  async function another(k: number) {
    const dd = c.days[k];
    const ctx = { today: dd.date, target: TAG_TARGET[dd.tag], weather: dd.weather ?? null };
    const others = new Set(c.days.filter((_, j) => j !== k).map((x) => x.itemIds.slice().sort().join("|")));
    const list = generate(pieces, profile, taste, ctx, 10).filter((g) => !others.has(g.key));
    const curKey = dd.itemIds.slice().sort().join("|");
    const i = list.findIndex((g) => g.key === curKey);
    const nxt = list[(i + 1) % Math.max(1, list.length)];
    if (nxt) await setDay(k, { itemIds: nxt.items.map((x) => x.id) });
  }
  async function toCalendar() {
    if (!confirm(`Add ${c.days.length} planned looks to your calendar?`)) return;
    for (const dd of c.days) await api.logWear({ date: dd.date, itemIds: dd.itemIds, planned: true });
    await refresh();
    toast("Added to your calendar");
  }
  async function remove() {
    if (!confirm("Delete this plan? Your closet isn’t affected.")) return;
    await api.deleteCapsule(c.id);
    await refresh();
    pop();
  }

  const byCat = (cat: string) => pieces.filter((p) => p.category === cat);
  const packed = c.packed ?? {};
  const packedN = pieces.filter((p) => packed[p.id]).length;

  return (
    <Overlay title={c.name} onBack={pop} right={<button className="chip" onClick={remove}>Delete</button>}>
      <div className="sec" style={{ paddingTop: 4 }}>
        <div className="stat">
          <div><b>{pieces.length}</b><span className="xs muted">pieces</span></div>
          <div><b>{stats.outfits}</b><span className="xs muted">good outfits</span></div>
          <div><b>{stats.perPiece}</b><span className="xs muted">per piece</span></div>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 10 }}>{stats.palette.map((h) => <span key={h} style={{ flex: 1, height: 10, borderRadius: 5, background: h, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.1)" }} />)}</div>
        {trip && cfg.trip && <div className="xs muted" style={{ marginTop: 8 }}>{cfg.trip.destination ? `${cfg.trip.destination} · ` : ""}{fmtDate(cfg.trip.start)} · {cfg.trip.days} days · {CLIMATE_LABEL(cfg.weather?.temp)}{cfg.weather?.rain ? " · rain likely" : ""}</div>}
      </div>
      <div className="seg" style={{ marginTop: 12 }}>
        <button className={tab === "pieces" ? "on" : ""} onClick={() => setTab("pieces")}>Pieces</button>
        <button className={tab === "days" ? "on" : ""} onClick={() => setTab("days")}>{trip ? "Days" : "Looks"}</button>
        <button className={tab === "pack" ? "on" : ""} onClick={() => setTab("pack")}>{trip ? "Packing" : "Checklist"}</button>
      </div>

      {tab === "pieces" && (
        <>
          {["Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Bags"].map((cat) => {
            const list = byCat(cat);
            if (!list.length) return null;
            return (
              <div key={cat}>
                <div className="sec" style={{ paddingTop: 14, paddingBottom: 0 }}><h3>{cat} · {list.length}</h3></div>
                <div className="grid3" style={{ paddingTop: 0 }}>
                  {list.map((p) => (
                    <button key={p.id} className="tile" onClick={() => setSheetItem(p)}>
                      <div className="img"><Img name={itemById[p.id]?.image} alt={p.name} /><span className="dot" style={{ background: p.colorHex }} />{cfg.pinned?.includes(p.id) && <span className="badge">📌 Kept</span>}</div>
                      <div className="b">{p.name}</div><div className="t">{p.colorName}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="sec" style={{ display: "flex", gap: 8, paddingBottom: 14 }}>
            <button className="btn light sm" style={{ flex: 1 }} disabled={busy} onClick={() => setAdding(true)}>＋ Always include…</button>
            <button className="btn dark sm" style={{ flex: 1 }} disabled={busy} onClick={() => rebuild({})}>{busy ? "Rebuilding…" : "Rebuild"}</button>
          </div>
        </>
      )}

      {tab === "days" && (
        <div className="sec" style={{ display: "grid", gap: 10 }}>
          {c.days.map((dd, k) => {
            const its = dd.itemIds.map((i) => itemById[i]).filter(Boolean);
            return (
              <div key={dd.date} className="card" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 96, flex: "none", background: "var(--stage)", borderRadius: 12 }}><Collage items={its} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 14 }}>{trip ? fmtDate(dd.date) : `Day ${k + 1}`}</b>
                  <div className="xs muted" style={{ margin: "2px 0 6px" }}>{its.map((i) => i.name).join(" · ")}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button className="chip" style={{ height: 28 }} onClick={async () => { const nt = TAGS[(TAGS.indexOf(dd.tag) + 1) % 3]; const ctx = { today: dd.date, target: TAG_TARGET[nt], weather: dd.weather ?? null }; const g = generate(pieces, profile, taste, ctx, 3)[0]; await setDay(k, { tag: nt, itemIds: g ? g.items.map((x) => x.id) : dd.itemIds }); }}>{cap(dd.tag)} ⟳</button>
                    <button className="chip" style={{ height: 28 }} onClick={() => another(k)}>↻ Another</button>
                    <button className="chip" style={{ height: 28 }} onClick={() => push({ t: "customize", itemIds: dd.itemIds, name: trip ? fmtDate(dd.date) : `Day ${k + 1}`, target: TAG_TARGET[dd.tag], weather: dd.weather ?? null })}>Customize</button>
                  </div>
                </div>
              </div>
            );
          })}
          <button className="btn light full" onClick={() => push({ t: "lineup", title: c.name, looks: c.days.map((dd, k) => ({ label: trip ? fmtDate(dd.date) : `Day ${k + 1}`, itemIds: dd.itemIds })) })}>See them on my avatar</button>
          {trip && <button className="btn dark full" onClick={toCalendar}>Add these looks to my calendar</button>}
          <p className="xs muted" style={{ textAlign: "center", lineHeight: 1.5 }}>Looks use only the pieces in this {trip ? "trip" : "capsule"}, repeat tops as little as possible, and follow each day’s dressiness and weather.</p>
        </div>
      )}

      {tab === "pack" && (
        <div className="sec">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <b>{packedN} of {pieces.length} {trip ? "packed" : "checked"}</b>
            <button className="chip" onClick={async () => { await api.patchCapsule(c.id, { packed: {} }); await refresh(); }}>Reset</button>
          </div>
          <div className="prog" style={{ marginBottom: 12 }}><i style={{ width: `${pieces.length ? (packedN / pieces.length) * 100 : 0}%` }} /></div>
          {["Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Bags"].map((cat) => {
            const list = byCat(cat);
            if (!list.length) return null;
            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div className="xs muted" style={{ fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 4 }}>{cat} ({list.length})</div>
                {list.map((p) => (
                  <label key={p.id} className="job" style={{ cursor: "pointer", borderBottom: "1px solid var(--line)" }}>
                    <input type="checkbox" checked={!!packed[p.id]} onChange={async (e) => { await api.patchCapsule(c.id, { packed: { ...packed, [p.id]: e.target.checked } }); await refresh(); }} />
                    <div className="th" style={{ width: 40, height: 40 }}><Img name={itemById[p.id]?.image} alt="" style={{ objectFit: "contain" }} /></div>
                    <span style={{ textDecoration: packed[p.id] ? "line-through" : "none", opacity: packed[p.id] ? 0.55 : 1 }}>{p.name}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {sheetItem && (
        <Sheet onClose={() => setSheetItem(null)}>
          <h2 className="h-l" style={{ marginBottom: 4 }}>{sheetItem.name}</h2>
          <p className="sm muted" style={{ marginBottom: 14 }}>{sheetItem.category} · {sheetItem.colorName}</p>
          <div style={{ display: "grid", gap: 8 }}>
            <button className="btn dark full" onClick={() => { const pinned = cfg.pinned?.includes(sheetItem.id) ? cfg.pinned.filter((x) => x !== sheetItem.id) : [...(cfg.pinned ?? []), sheetItem.id]; setSheetItem(null); rebuild({ pinned }); }}>{cfg.pinned?.includes(sheetItem.id) ? "Stop always keeping" : "Always keep this"}</button>
            <button className="btn light full" onClick={() => { const id = sheetItem.id; setSheetItem(null); rebuild({ excluded: [...(cfg.excluded ?? []), id], pinned: (cfg.pinned ?? []).filter((x) => x !== id) }); }}>Leave it out &amp; rebuild</button>
            <button className="btn light full" onClick={() => { push({ t: "item", id: sheetItem.id }); setSheetItem(null); }}>Open item</button>
          </div>
        </Sheet>
      )}
      {adding && (
        <div className="overlay" style={{ zIndex: 50 }}>
          <div className="ov-hdr"><div className="grow">Always include</div><button className="chip on" onClick={() => { setAdding(false); rebuild({}); }}>Done &amp; rebuild</button></div>
          <div className="ov-body"><PickItems selected={cfg.pinned ?? []} onToggle={(id) => { const cur = cfg.pinned ?? []; api.patchCapsule(c.id, { config: { ...cfg, pinned: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id], excluded: (cfg.excluded ?? []).filter((x) => x !== id) } }).then(refresh); }} /></div>
        </div>
      )}
    </Overlay>
  );
}

const CLIMATE_LABEL = (t?: number) => (t == null ? "" : t <= 10 ? "cold" : t <= 17 ? "cool" : t <= 25 ? "mild" : "hot");

function buildStats(pieces: GItem[], profile: Parameters<typeof buildCapsule>[1], cfg: CapsuleConfig) {
  const r = buildCapsule(pieces, profile, { item: {}, pair: {} }, { ...cfg, pinned: pieces.map((p) => p.id), excluded: [], quota: Object.fromEntries(["Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Bags"].map((c) => [c, pieces.filter((p) => p.category === c).length])) });
  return r.stats;
}

/* ------------------------------------------------------------------ Insights: coverage, redundancy, gaps */

export function InsightsPlus() {
  const { gitems, profile, taste, push, itemById, profile: p2 } = useStore();
  const cov = useMemo(() => (gitems.length >= 3 ? coverage(gitems, profile, taste, today()) : null), [gitems, profile, taste]);
  const red = useMemo(() => redundancy(gitems, profile), [gitems, profile]);
  const gaps = useMemo(() => (gitems.length >= 3 ? gapSuggestions(gitems, profile, { direction: p2.basics.direction }).slice(0, 5) : []), [gitems, profile, p2.basics.direction]);
  if (!cov) return null;
  return (
    <>
      <div className="sec">
        <h3>Coverage · {Math.round(cov.overall * 100)}%</h3>
        <div className="card" style={{ padding: 14 }}>
          {cov.dims.map((d) => (
            <div key={d.key} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}><span>{d.label}</span><span className="muted">{d.good >= 8 ? "well covered" : d.good === 0 ? "gap" : `${d.good} good looks`}</span></div>
              <div className="prog" style={{ marginTop: 4 }}><i style={{ width: `${d.score * 100}%`, background: d.score >= 0.7 ? "var(--good)" : d.score >= 0.35 ? "var(--ink)" : "var(--warn)" }} /></div>
              {d.score < 0.5 && d.hint && <div className="xs muted" style={{ marginTop: 3 }}>Would help: {d.hint}</div>}
            </div>
          ))}
          <div className="xs muted">How many good, different outfits your closet can make for each situation.</div>
        </div>
      </div>

      {gaps.length > 0 && (
        <div className="sec">
          <h3>One piece, more outfits</h3>
          <p className="sm muted" style={{ marginBottom: 10 }}>The purchases that would add the most good outfits to what you already own, in colours that suit you.</p>
          <div style={{ display: "grid", gap: 8 }}>
            {gaps.map((g) => (
              <div key={g.piece.id} className="card" style={{ padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: g.piece.colorHex, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)", flex: "none" }} />
                <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 14 }}>{g.piece.name}</b><div className="xs muted">{g.piece.category} · suits you {g.fit}%</div></div>
                <span style={{ textAlign: "right", lineHeight: 1.2 }}><b style={{ color: "var(--good)", fontSize: 15 }}>+{g.unlock}</b><br /><span className="xs muted">{g.kind === "new" ? "new outfits" : "looks it fits"}</span></span>
                <button className="chip" onClick={() => push({ t: "findpiece", piece: g.piece })}>Find it</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {red.length > 0 && (
        <div className="sec">
          <h3>Doubles</h3>
          {red.map((r) => (
            <div key={r.ids.join()} className="card" style={{ padding: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>{r.why}.</div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, overflowX: "auto" }}>
                {r.ids.map((id) => <button key={id} onClick={() => push({ t: "item", id })} style={{ width: 52, height: 58, borderRadius: 10, background: "var(--tile)", border: r.keep === id ? "2px solid var(--good)" : 0, padding: 0, flex: "none" }} aria-label={itemById[id]?.name}><Img name={itemById[id]?.image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></button>)}
              </div>
              <div className="xs muted" style={{ marginTop: 6 }}>Green outline = the one you reach for most. Nothing is deleted.</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ find a suggested piece */

export function FindPiece({ piece }: { piece: import("@/lib/shop/types").Piece }) {
  const { pop, wishlist } = useStore();
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof api.settings>> | null>(null);
  useEffect(() => { api.settings().then(setSettings).catch(() => {}); }, []);
  return (
    <Overlay title={piece.name} onBack={pop}>
      <div className="sec" style={{ paddingTop: 4 }}>
        <p className="sm muted" style={{ lineHeight: 1.5, marginBottom: 6 }}>Capsule suggests this because it would add the most good outfits to your closet in a colour that suits you. Find one you like, then ♡ save it to your wishlist.</p>
      </div>
      <PieceCard look={{ id: null }} piece={piece} products={wishlist.filter((p) => p.pieceId === piece.id)} settings={settings} direction="" alwaysSave reload={async () => {}} />
    </Overlay>
  );
}

