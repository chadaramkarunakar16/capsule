"use client";
import { useEffect, useMemo, useState } from "react";
import { api, imgPath } from "@/lib/api";
import { imageUrl } from "@/lib/engine";
import { CANVAS, DEFAULT_ASPECT, HAIR_COLOURS, SKIN_TONES, defaultBuild, geometry, layers, placeItem } from "@/lib/avatar/geometry";
import type { HairStyle, Profile } from "@/lib/style/profile";
import type { Item } from "@/lib/types";
import { PickItems } from "./pick";
import { Overlay, useImageUrl } from "./ui";
import { useStore } from "./store";

const BASE = "#e6e1d8"; // neutral base layer, so the figure is never "bare"
const DEFAULT_SKIN = "#e0ac86", DEFAULT_HAIR = "#3b2a20";

/** Natural width÷height of each item's photo (loaded once, cached). */
const aspectCache = new Map<string, number>();
function useAspects(items: Item[]) {
  const [, tick] = useState(0);
  useEffect(() => {
    let alive = true;
    for (const it of items) {
      if (aspectCache.has(it.image)) continue;
      const im = new Image();
      im.onload = () => { aspectCache.set(it.image, im.naturalWidth / Math.max(1, im.naturalHeight)); if (alive) tick((n) => n + 1); };
      imageUrl(imgPath(it.image)).then((u) => { im.src = u; }).catch(() => {});
    }
    return () => { alive = false; };
  }, [items]);
  return (it: Item) => aspectCache.get(it.image) ?? DEFAULT_ASPECT[it.category] ?? 1;
}

/** The figure itself. `profile` can be a draft (editor) or the saved one. */
export function AvatarFigure({ profile, items = [], width = 220, label = false }: { profile: Profile; items?: Item[]; width?: number; label?: boolean }) {
  const g = useMemo(() => geometry(profile), [profile]);
  const aspect = useAspects(items);
  const a = profile.avatar;
  const skin = a.skin ?? DEFAULT_SKIN, hair = a.hair ?? DEFAULT_HAIR;
  const { cx } = g;
  const rx = g.headR * 0.82, ry = g.headR;
  const sY = g.shoulderY;
  const midThigh = g.crotchY + (g.kneeY - g.crotchY) * 0.42;
  const L = (n: number) => cx - n, R = (n: number) => cx + n;

  const torso = (s: 1 | -1) => {
    const X = (n: number) => cx + s * n;
    return `M ${X(g.neckHalf * 1.6)} ${sY - 4} L ${X(g.shoulderHalf)} ${sY + 4} C ${X(g.shoulderHalf)} ${g.chestY}, ${X(g.waistHalf * 1.1)} ${g.chestY + 30}, ${X(g.waistHalf)} ${g.waistY} C ${X(g.waistHalf)} ${g.waistY + (g.hipY - g.waistY) * 0.45}, ${X(g.hipHalf)} ${g.hipY - 28}, ${X(g.hipHalf)} ${g.hipY} L ${X(g.hipHalf * 0.96)} ${midThigh} L ${cx} ${midThigh} L ${cx} ${sY - 4} Z`;
  };
  const leg = (s: 1 | -1) => {
    const X = (n: number) => cx + s * n;
    return `M ${X(g.hipHalf)} ${g.hipY} L ${X(g.hipHalf * 0.64)} ${g.kneeY} L ${X(g.hipHalf * 0.5)} ${g.ankleY} L ${X(g.hipHalf * 0.12)} ${g.ankleY} L ${X(g.hipHalf * 0.2)} ${g.kneeY} L ${X(1)} ${g.crotchY} Z`;
  };
  const arm = (s: 1 | -1) => {
    const X = (n: number) => cx + s * n;
    return `M ${X(g.shoulderHalf - 2)} ${sY + 12} Q ${X(g.shoulderHalf + 14)} ${sY + 0.17 * g.H} ${X(g.hipHalf + 20)} ${g.wristY}`;
  };
  const hairBack = (style: HairStyle) =>
    style === "long" ? <path d={`M ${L(rx * 1.05)} ${g.headCY - ry * 0.4} L ${L(rx * 1.2)} ${sY + 46} L ${R(rx * 1.2)} ${sY + 46} L ${R(rx * 1.05)} ${g.headCY - ry * 0.4} Z`} fill={hair} /> : null;
  const hairFront = (style: HairStyle) => {
    if (style === "none") return null;
    const cap = `M ${L(rx * 1.02)} ${g.headCY + ry * 0.05} Q ${L(rx * 1.08)} ${g.headCY - ry * 1.2} ${cx} ${g.headCY - ry * 1.14} Q ${R(rx * 1.08)} ${g.headCY - ry * 1.2} ${R(rx * 1.02)} ${g.headCY + ry * 0.05} Q ${R(rx * 0.75)} ${g.headCY - ry * 0.55} ${cx} ${g.headCY - ry * 0.62} Q ${L(rx * 0.75)} ${g.headCY - ry * 0.55} ${L(rx * 1.02)} ${g.headCY + ry * 0.05} Z`;
    return (
      <>
        <path d={cap} fill={hair} />
        {style === "medium" && <path d={`M ${L(rx * 1.04)} ${g.headCY} L ${L(rx * 1.1)} ${g.chinY + 6} L ${L(rx * 0.8)} ${g.headCY + ry * 0.2} Z M ${R(rx * 1.04)} ${g.headCY} L ${R(rx * 1.1)} ${g.chinY + 6} L ${R(rx * 0.8)} ${g.headCY + ry * 0.2} Z`} fill={hair} />}
        {style === "long" && <path d={`M ${L(rx * 1.04)} ${g.headCY} L ${L(rx * 1.16)} ${sY + 40} L ${L(rx * 0.78)} ${g.headCY + ry * 0.3} Z M ${R(rx * 1.04)} ${g.headCY} L ${R(rx * 1.16)} ${sY + 40} L ${R(rx * 0.78)} ${g.headCY + ry * 0.3} Z`} fill={hair} />}
        {style === "bun" && <circle cx={cx} cy={g.headCY - ry * 1.28} r={ry * 0.34} fill={hair} />}
      </>
    );
  };

  const worn = layers(items);
  return (
    <figure style={{ margin: 0, position: "relative", width }}>
      <svg viewBox={`0 0 ${CANVAS.w} ${CANVAS.h}`} width={width} height={(width * CANVAS.h) / CANVAS.w} role="img" aria-label="Avatar preview" style={{ display: "block" }}>
        <ellipse cx={cx} cy={g.footY + 4} rx={g.hipHalf * 1.3} ry={9} fill="rgba(0,0,0,.08)" />
        {hairBack(a.hairStyle)}
        {/* legs, then arms, then base layer, so clothes sit on top of a believable body */}
        <path d={leg(-1)} fill={skin} /><path d={leg(1)} fill={skin} />
        <ellipse cx={L(g.hipHalf * 0.32)} cy={g.footY - 6} rx={Math.max(18, g.hipHalf * 0.3)} ry={9} fill={skin} />
        <ellipse cx={R(g.hipHalf * 0.32)} cy={g.footY - 6} rx={Math.max(18, g.hipHalf * 0.3)} ry={9} fill={skin} />
        <path d={arm(-1)} stroke={skin} strokeWidth={g.armHalf * 2} strokeLinecap="round" fill="none" />
        <path d={arm(1)} stroke={skin} strokeWidth={g.armHalf * 2} strokeLinecap="round" fill="none" />
        <circle cx={L(g.hipHalf + 20)} cy={g.wristY + 10} r={g.armHalf * 0.95} fill={skin} />
        <circle cx={R(g.hipHalf + 20)} cy={g.wristY + 10} r={g.armHalf * 0.95} fill={skin} />
        <rect x={cx - g.neckHalf} y={g.headCY + ry * 0.55} width={g.neckHalf * 2} height={sY - g.headCY - ry * 0.4} fill={skin} />
        <path d={torso(-1)} fill={BASE} /><path d={torso(1)} fill={BASE} />
        <ellipse cx={cx} cy={g.headCY} rx={rx} ry={ry} fill={skin} />
        {hairFront(a.hairStyle)}
        {worn.map((it) => {
          const attrs = it.attrs as { length?: string };
          const r = placeItem(it.category, aspect(it), g, { length: typeof attrs?.length === "string" ? attrs.length : undefined, fit: it.fit });
          return r ? <SvgImg key={it.id} name={it.image} x={r.x} y={r.y} width={r.w} height={r.h} preserveAspectRatio="xMidYMid meet" /> : null;
        })}
      </svg>
      {label && <figcaption style={{ position: "absolute", top: 4, left: 4, fontSize: 10.5, fontWeight: 600, background: "rgba(255,255,255,.9)", borderRadius: 99, padding: "3px 9px", color: "var(--muted)" }}>Preview — approximate</figcaption>}
    </figure>
  );
}

/* ------------------------------------------------------------------ avatar editor */

const Slider = ({ label, value, onChange, min = -1, max = 1, hint }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; hint?: string }) => (
  <div>
    <label className="f" style={{ display: "flex", justifyContent: "space-between" }}><span>{label}</span><span className="muted">{hint}</span></label>
    <input type="range" min={min} max={max} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--ink)" }} />
  </div>
);

export function AvatarEditor() {
  const { profile, saveProfile, pop, toast, push } = useStore();
  const [p, setP] = useState<Profile>(() => JSON.parse(JSON.stringify(profile)));
  const set = (x: Partial<Profile["avatar"]>) => setP((cur) => ({ ...cur, avatar: { ...cur.avatar, ...x } }));
  const a = p.avatar;
  const startBuild = a.build ?? defaultBuild(p.basics.height, p.basics.weight);
  const measured = !!(p.measurements.chest || p.measurements.hip);
  return (
    <Overlay title="My avatar" onBack={pop} foot={<button className="btn dark full" onClick={async () => { await saveProfile(p); toast("Avatar saved"); pop(); }}>Save</button>}>
      <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 4px", background: "var(--stage)", margin: "0 20px", borderRadius: 20 }}>
        <AvatarFigure profile={p} width={170} />
      </div>
      <div className="sec" style={{ display: "grid", gap: 14 }}>
        <p className="xs muted" style={{ lineHeight: 1.5 }}>This is a simple figure to help you judge proportion and colour — not a portrait. Proportions start from your profile (shoulders, hips, torso and legs{measured ? ", and your measurements" : ""}); nudge the sliders until it feels like you.</p>
        <div>
          <label className="f">Skin tone</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SKIN_TONES.map((c) => <button key={c} aria-label={`Skin ${c}`} onClick={() => set({ skin: c })} className="sw" style={{ background: c, boxShadow: a.skin === c ? "0 0 0 2.5px var(--ink)" : "inset 0 0 0 1px rgba(0,0,0,.12)", width: 34, height: 34 }} />)}
            <label className="sw" style={{ width: 34, height: 34, display: "grid", placeItems: "center", cursor: "pointer", background: a.skin && !SKIN_TONES.includes(a.skin) ? a.skin : "#fff", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.2)", fontSize: 16 }}>＋<input type="color" value={a.skin ?? "#e0ac86"} onChange={(e) => set({ skin: e.target.value })} style={{ display: "none" }} /></label>
          </div>
          {profile.color.photos > 0 && <p className="xs muted" style={{ marginTop: 6 }}>Starting value came from your colour photos.</p>}
        </div>
        <div>
          <label className="f">Hair</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {HAIR_COLOURS.map((c) => <button key={c} aria-label={`Hair ${c}`} onClick={() => set({ hair: c })} className="sw" style={{ background: c, boxShadow: a.hair === c ? "0 0 0 2.5px var(--ink)" : "inset 0 0 0 1px rgba(0,0,0,.12)", width: 30, height: 30 }} />)}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["short", "medium", "long", "bun", "none"] as HairStyle[]).map((s) => <button key={s} className={`chip ${a.hairStyle === s ? "on" : ""}`} onClick={() => set({ hairStyle: s })}>{s === "none" ? "Bald / covered" : s[0].toUpperCase() + s.slice(1)}</button>)}
          </div>
        </div>
        {!measured && <Slider label="Build" value={startBuild} onChange={(v) => set({ build: v })} hint={a.build == null && p.basics.weight ? "from height & weight — adjust freely" : undefined} />}
        <Slider label="Shoulders" value={a.shoulders} onChange={(v) => set({ shoulders: v })} />
        <Slider label="Waist" value={a.waist} onChange={(v) => set({ waist: v })} />
        <Slider label="Hips" value={a.hips} onChange={(v) => set({ hips: v })} />
        <Slider label="Leg length" value={a.legs} onChange={(v) => set({ legs: v })} />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn light sm" style={{ flex: 1 }} onClick={() => set({ build: null, shoulders: 0, hips: 0, legs: 0, waist: 0 })}>Reset sliders</button>
          <button className="btn light sm" style={{ flex: 1 }} onClick={() => push({ t: "style", section: "body" })}>Edit proportions</button>
        </div>
      </div>
    </Overlay>
  );
}

/* ------------------------------------------------------------------ try-on screen */

export function TryOnScreen({ itemIds, name }: { itemIds: string[]; name?: string }) {
  const { profile, itemById, outfits, pop, push, toast, refresh } = useStore();
  const [ids, setIds] = useState<string[]>(itemIds);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const items = ids.map((i) => itemById[i]).filter(Boolean);
  const noAvatar = !profile.body.shoulderHip && !profile.body.torsoLeg && !profile.avatar.skin;
  const tryable = items.filter((i) => ["Tops", "Bottoms", "Dresses"].includes(i.category));

  async function save() {
    setSaving(true);
    try { await api.createOutfit({ name: name || "Look on me", itemIds: ids }); await refresh(); toast("Saved to Outfits"); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save"); }
    setSaving(false);
  }
  return (
    <Overlay
      title={name || "On me"}
      onBack={pop}
      right={<button className="chip" onClick={() => push({ t: "avatar" })}>Edit avatar</button>}
      foot={
        <>
          <button className="btn light" style={{ flex: 1 }} disabled={!tryable.length} onClick={() => push({ t: "phototryon", itemIds: ids })}>On my photo</button>
          <button className="btn dark" style={{ flex: 1 }} disabled={saving || !ids.length} onClick={save}>Save look</button>
        </>
      }
    >
      {noAvatar && (
        <button className="card" style={{ margin: "4px 20px 8px", padding: "10px 14px", width: "calc(100% - 40px)", textAlign: "left", background: "#fff8ea", borderColor: "#f1deb2" }} onClick={() => push({ t: "avatar" })}>
          <b>Make it look like you</b><div className="xs muted">Set your skin tone and proportions to personalise this figure ›</div>
        </button>
      )}
      <div style={{ display: "flex", justifyContent: "center", background: "var(--stage)", margin: "4px 20px 0", borderRadius: 20, padding: "8px 0" }}>
        <AvatarFigure profile={profile} items={items} width={250} label />
      </div>
      <div className="sec" style={{ paddingTop: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {items.map((i) => <button key={i.id} className="chip on" onClick={() => setIds(ids.filter((x) => x !== i.id))} aria-label={`Take off ${i.name}`}>{i.name} ✕</button>)}
          <button className="chip" onClick={() => setPicking(true)}>＋ Add piece</button>
        </div>
        {outfits.length > 0 && (
          <>
            <h3 style={{ marginTop: 16 }}>Try a saved outfit</h3>
            <div className="chips" style={{ padding: 0 }}>
              {outfits.map((o) => <button key={o.id} className="chip" onClick={() => setIds(o.itemIds)}>{o.name}</button>)}
            </div>
          </>
        )}
        <p className="xs muted" style={{ marginTop: 14, lineHeight: 1.5 }}>The figure shows your photos of each piece on a simple body, so you can judge colour, proportion and how pieces balance. It is an approximation — drape, fit and fabric aren’t modelled.</p>
      </div>
      {picking && (
        <div className="overlay" style={{ zIndex: 50 }}>
          <div className="ov-hdr"><div className="grow">Add to this look</div><button className="chip on" onClick={() => setPicking(false)}>Done</button></div>
          <div className="ov-body"><PickItems selected={ids} onToggle={(id) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))} /></div>
        </div>
      )}
    </Overlay>
  );
}

/* ------------------------------------------------------------------ lineup: several looks side by side */

export function Lineup({ looks, title }: { looks: { label: string; itemIds: string[] }[]; title?: string }) {
  const { profile, itemById, pop, push } = useStore();
  return (
    <Overlay title={title || "Side by side"} onBack={pop}>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "8px 20px 16px", scrollSnapType: "x mandatory" }}>
        {looks.map((l, k) => {
          const items = l.itemIds.map((i) => itemById[i]).filter(Boolean);
          return (
            <button key={k} onClick={() => push({ t: "tryon", itemIds: l.itemIds, name: l.label })} style={{ flex: "none", scrollSnapAlign: "start", background: "var(--stage)", border: 0, borderRadius: 18, padding: "8px 6px 10px", textAlign: "center" }}>
              <AvatarFigure profile={profile} items={items} width={150} />
              <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>{l.label}</div>
            </button>
          );
        })}
      </div>
      <p className="xs muted" style={{ padding: "0 24px", lineHeight: 1.5 }}>Tap a figure to open it bigger. Previews are approximate.</p>
    </Overlay>
  );
}

export function AvatarCard() {
  const { profile, push } = useStore();
  return (
    <div className="sec">
      <h3>My avatar</h3>
      <div className="card" style={{ padding: 12, display: "flex", gap: 14, alignItems: "center" }}>
        <div style={{ background: "var(--stage)", borderRadius: 14, padding: "4px 6px" }}><AvatarFigure profile={profile} width={64} /></div>
        <div style={{ flex: 1 }}>
          <b style={{ fontSize: 15 }}>Preview figure</b>
          <div className="xs muted" style={{ lineHeight: 1.45, margin: "2px 0 8px" }}>See outfits on a figure with your proportions and colouring.</div>
          <button className="btn dark sm" onClick={() => push({ t: "avatar" })}>Edit avatar</button>
        </div>
      </div>
    </div>
  );
}


function SvgImg({ name, ...rest }: { name: string } & React.SVGProps<SVGImageElement>) {
  const href = useImageUrl(name);
  return href ? <image href={href} {...rest} /> : null;
}
