"use client";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { downscaleJpeg } from "@/lib/image";
import { HAIR_COLOURS } from "@/lib/avatar/geometry";
import { BEARDS, FRAMES, HAIRSTYLES, type BeardStyle, type FrameStyle, type HairStyle, type HairType, type Density } from "@/lib/grooming/catalog";
import { HEAD, anchors, beardShapes, bodyPath, framePaths, hairShapes, headPath, partLine } from "@/lib/grooming/draw";
import { barberText, frameColours, suggestBeards, suggestFrames, suggestHair, type FrameColour, type Result } from "@/lib/grooming/suggest";
import type { FaceShape } from "@/lib/style/face";
import type { Piece } from "@/lib/shop/types";
import type { Profile, SavedStyle } from "@/lib/style/profile";
import { Overlay, Img } from "./ui";
import { useStore } from "./store";

const DEFAULT_SKIN = "#e0ac86", DEFAULT_HAIR = "#3b2a20";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const darker = (hex: string, amt = 26) => { const n = parseInt(hex.slice(1), 16); const c = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"); return `#${c((n >> 16) - amt)}${c(((n >> 8) & 255) - amt)}${c((n & 255) - amt)}`; };

/* ------------------------------------------------------------------ portrait */

export function Portrait({ face, hair, beard, frame, skin = DEFAULT_SKIN, hairColour = DEFAULT_HAIR, frameColour = "#1b1b1d", width = 140 }: {
  face: FaceShape | null; hair?: HairStyle["illus"] | null; beard?: BeardStyle["illus"] | null; frame?: string | null;
  skin?: string; hairColour?: string; frameColour?: string; width?: number;
}) {
  const shape = face ?? "oval";
  const a = anchors(shape);
  const hs = hair ? hairShapes(hair, shape) : null;
  const bs = beard ? beardShapes(beard.kind, beard.length, shape) : null;
  const fg = frame ? framePaths(frame, a.cx, a.eyeY, a.cheekX * 2 * 0.93) : null;
  const shade = darker(skin, 18);
  return (
    <svg viewBox={`0 0 ${HEAD.w} ${HEAD.h}`} width={width} height={(width * HEAD.h) / HEAD.w} role="img" aria-label="Illustration" style={{ display: "block" }}>
      {hs && hs.back.map((d, i) => <path key={"b" + i} d={d} fill={hairColour} opacity={hs.opacity} />)}
      {hs && hs.strands.map((d, i) => <path key={"s" + i} d={d} stroke={hairColour} strokeWidth={hair?.extra === "braids" ? 7 : hair?.extra === "locs" ? 9 : 12} strokeLinecap="round" fill="none" />)}
      <path d={bodyPath()} fill="#d9d3c8" />
      <rect x={a.cx - 26} y={a.cy + 60} width={52} height={80} rx={14} fill={shade} />
      <ellipse cx={a.cx - a.cheekX + 2} cy={a.eyeY + 14} rx={9} ry={17} fill={shade} />
      <ellipse cx={a.cx + a.cheekX - 2} cy={a.eyeY + 14} rx={9} ry={17} fill={shade} />
      <path d={headPath(shape)} fill={skin} />
      {/* quiet features, just enough to read the proportions */}
      <g stroke={darker(skin, 70)} strokeLinecap="round" fill="none" opacity={0.7}>
        <path d={`M ${a.cx - a.eyeDx - 12} ${a.eyeY - 16} q 12 -6 24 0`} strokeWidth={3} />
        <path d={`M ${a.cx + a.eyeDx - 12} ${a.eyeY - 16} q 12 -6 24 0`} strokeWidth={3} />
        <path d={`M ${a.cx} ${a.eyeY + 6} q -5 22 3 26`} strokeWidth={2} />
        <path d={`M ${a.cx - 14} ${a.mouthY + 6} q 14 8 28 0`} strokeWidth={3} />
      </g>
      <circle cx={a.cx - a.eyeDx} cy={a.eyeY} r={4} fill="#3a3330" /><circle cx={a.cx + a.eyeDx} cy={a.eyeY} r={4} fill="#3a3330" />
      {bs && bs.fills.map((f, i) => <path key={"f" + i} d={f.d} fill={hairColour} opacity={f.opacity} />)}
      {bs && bs.lines.map((d, i) => <path key={"l" + i} d={d} stroke={hairColour} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
      {hs && hs.front.map((d, i) => <path key={"h" + i} d={d} fill={hairColour} opacity={hs.opacity} />)}
      {hs && hs.fadeBands.map((b, i) => <path key={"fb" + i} d={b.d} fill={skin} opacity={b.opacity} />)}
      {hs && hs.curls.map((c, i) => <circle key={"c" + i} cx={c.x} cy={c.y} r={c.r} fill={hairColour} opacity={hs.opacity} />)}
      {hair && partLine(hair, shape) && <path d={partLine(hair, shape)!} stroke={darker(skin, 60)} strokeWidth={2} fill="none" opacity={0.6} />}
      {fg && (
        <g fill="rgba(255,255,255,.18)" stroke={frameColour} strokeWidth={fg.thickness} strokeLinejoin="round" strokeLinecap="round">
          {fg.brow && <path d={fg.brow} fill={frameColour} stroke="none" opacity={0.95} />}
          {fg.lenses.map((d, i) => <path key={i} d={d} />)}
          <path d={fg.bridge} fill="none" />
          {fg.arms.map((d, i) => <path key={"a" + i} d={d} fill="none" />)}
        </g>
      )}
    </svg>
  );
}

function usePortraitColours() {
  const { profile } = useStore();
  return { face: profile.face.shape, skin: profile.avatar.skin ?? DEFAULT_SKIN, hairColour: profile.avatar.hair ?? DEFAULT_HAIR };
}

/* ------------------------------------------------------------------ home */

const Chips = <T extends string | number>({ options, value, onPick, labels }: { options: readonly T[]; value: T | null; onPick: (v: T | null) => void; labels?: Record<string, string> }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
    {options.map((o) => <button key={String(o)} className={`chip ${value === o ? "on" : ""}`} onClick={() => onPick(value === o ? null : o)}>{labels?.[String(o)] ?? cap(String(o))}</button>)}
  </div>
);

export function GroomingHome() {
  const { profile, saveProfile, pop, push } = useStore();
  const [tab, setTab] = useState<"hair" | "beard" | "glasses">("hair");
  const [group, setGroup] = useState<"all" | "short" | "medium" | "long">("all");
  const [open, setOpen] = useState(!profile.grooming.hairType);
  const g = profile.grooming;
  const { skin, hairColour } = usePortraitColours();
  const setG = (x: Partial<Profile["grooming"]>) => saveProfile({ ...profile, grooming: { ...g, ...x } });

  const hair = useMemo(() => suggestHair(profile), [profile]);
  const beards = useMemo(() => suggestBeards(profile), [profile]);
  const frames = useMemo(() => suggestFrames(profile), [profile]);
  const needs = tab === "hair" ? hair.needs : tab === "beard" ? beards.needs : frames.needs;
  const hairShown = hair.filter((r) => group === "all" || r.item.group === group);

  const card = <T extends HairStyle | BeardStyle | FrameStyle>(r: Result<T>, kind: "hair" | "beard" | "glasses") => {
    const it = r.item as HairStyle & BeardStyle & FrameStyle;
    const saved = g.saved.some((s) => s.kind === kind && s.id === it.id);
    return (
      <button key={it.id} className="ocard" style={{ padding: 8 }} onClick={() => push({ t: "groomstyle", kind, id: it.id })}>
        <div style={{ background: "var(--tile)", borderRadius: 14, display: "grid", placeItems: "center", padding: "6px 0 0", overflow: "hidden", position: "relative" }}>
          <Portrait face={profile.face.shape} skin={skin} hairColour={hairColour} width={118}
            hair={kind === "hair" ? it.illus : null} beard={kind === "beard" ? it.illus : null} frame={kind === "glasses" ? it.id : null} frameColour={frameColours(profile.color.season).colours[0].hex} />
          {saved && <span style={{ position: "absolute", top: 6, right: 8, color: "var(--accent)" }}>♥</span>}
        </div>
        <div className="n">{it.name}</div>
        <div className="s">{r.score}% match{r.reasons[0] ? ` · ${r.reasons[0].replace(/ \(.* face\)$/, "")}` : ""}</div>
      </button>
    );
  };

  return (
    <Overlay title="Hair, beard & glasses" onBack={pop}>
      <div className="seg" style={{ marginTop: 4 }}>
        {(["hair", "beard", "glasses"] as const).map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t === "hair" ? "Hair" : t === "beard" ? "Facial hair" : "Glasses"}</button>)}
      </div>

      {needs && needs.includes("face shape") && (
        <button className="card" onClick={() => push({ t: "style", section: "face" })} style={{ margin: "12px 20px 0", padding: "12px 14px", width: "calc(100% - 40px)", textAlign: "left", background: "#fff8ea", borderColor: "#f1deb2" }}>
          <b>Find your face shape first</b><div className="xs muted">Suggestions are matched to it — takes a photo or one tap ›</div>
        </button>
      )}

      {tab !== "glasses" && (
        <div className="sec" style={{ paddingTop: 12 }}>
          <button className="chip" onClick={() => setOpen(!open)}>{open ? "Hide" : "About your"} {tab === "hair" ? "hair" : "beard"} {open ? "" : "›"}</button>
          {open && (
            <div className="card" style={{ padding: 14, marginTop: 10, display: "grid", gap: 12 }}>
              {tab === "hair" ? (
                <>
                  <div><label className="f">Hair type</label><Chips options={["straight", "wavy", "curly", "coily"] as HairType[]} value={g.hairType} onPick={(v) => setG({ hairType: v })} /></div>
                  <div><label className="f">Density</label><Chips options={["thin", "medium", "thick"] as Density[]} value={g.density} onPick={(v) => setG({ density: v })} /></div>
                  <div><label className="f">Current length</label><Chips options={["short", "medium", "long"] as const} value={g.length} onPick={(v) => setG({ length: v })} /></div>
                  <div><label className="f">Effort you want to put in</label><Chips options={[1, 2, 3] as const} value={g.maintenance} onPick={(v) => setG({ maintenance: v })} labels={{ 1: "Wash and go", 2: "A few minutes", 3: "Happy to style daily" }} /></div>
                  <label className="job" style={{ cursor: "pointer" }}><input type="checkbox" checked={g.receding} onChange={(e) => setG({ receding: e.target.checked })} /><span>My hairline is receding or thinning at the temples</span></label>
                </>
              ) : (
                <>
                  <div><label className="f">Facial hair growth</label><Chips options={["patchy", "full"] as const} value={g.beardGrowth} onPick={(v) => setG({ beardGrowth: v })} labels={{ patchy: "Patchy / thin", full: "Full and even" }} /></div>
                  <div><label className="f">Upkeep you're happy with</label><Chips options={[1, 2, 3] as const} value={g.maintenance} onPick={(v) => setG({ maintenance: v })} labels={{ 1: "Minimal", 2: "Weekly trim", 3: "Sharp, often" }} /></div>
                </>
              )}
              <p className="xs muted" style={{ lineHeight: 1.5 }}>Stays on this computer. Everything here is a suggestion — your stylist knows your hair in person.</p>
            </div>
          )}
        </div>
      )}

      {tab === "hair" && (
        <>
          <div className="chips" style={{ marginTop: 12 }}>{(["all", "short", "medium", "long"] as const).map((x) => <button key={x} className={`chip ${group === x ? "on" : ""}`} onClick={() => setGroup(x)}>{cap(x)}</button>)}</div>
          <div className="grid2">{hairShown.slice(0, 14).map((r) => card(r, "hair"))}</div>
        </>
      )}
      {tab === "beard" && (
        !g.facialHair ? (
          <div className="sec" style={{ paddingTop: 16 }}>
            <div className="card" style={{ padding: 16 }}>
              <b>Facial hair ideas</b>
              <p className="sm muted" style={{ margin: "6px 0 12px", lineHeight: 1.5 }}>Beard, stubble and moustache styles matched to your face shape and how your hair grows. Only shown if you want it.</p>
              <button className="btn dark sm" onClick={() => { setG({ facialHair: true }); setOpen(true); }}>Show facial hair ideas</button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid2" style={{ paddingTop: 12 }}>{beards.slice(0, 10).map((r) => card(r, "beard"))}</div>
            <div style={{ padding: "0 20px 16px" }}><button className="chip" onClick={() => setG({ facialHair: false })}>Hide this section</button></div>
          </>
        )
      )}
      {tab === "glasses" && (
        <>
          <div className="sec" style={{ paddingTop: 12 }}>
            <button className="btn dark full" onClick={() => push({ t: "glassesphoto" })}>Try frames on my photo</button>
            <p className="xs muted" style={{ marginTop: 6, lineHeight: 1.5 }}>Your photo is processed on this device and never uploaded.</p>
          </div>
          <div className="grid2" style={{ paddingTop: 4 }}>{frames.slice(0, 11).map((r) => card(r, "glasses"))}</div>
        </>
      )}

      {g.saved.length > 0 && (
        <div className="sec" style={{ paddingBottom: 16 }}>
          <h3>Saved</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {g.saved.map((s) => {
              const name = s.kind === "hair" ? HAIRSTYLES.find((x) => x.id === s.id)?.name : s.kind === "beard" ? BEARDS.find((x) => x.id === s.id)?.name : FRAMES.find((x) => x.id === s.id)?.name;
              return name ? <button key={s.kind + s.id} className="chip" onClick={() => push({ t: "groomstyle", kind: s.kind, id: s.id })}>♥ {name}</button> : null;
            })}
          </div>
        </div>
      )}
    </Overlay>
  );
}

/* ------------------------------------------------------------------ one style, in detail */

export function StyleDetail({ kind, id }: { kind: "hair" | "beard" | "glasses"; id: string }) {
  const { profile, saveProfile, pop, push, toast } = useStore();
  const { skin, hairColour: baseHair } = usePortraitColours();
  const [hairColour, setHairColour] = useState(baseHair);
  const season = profile.color.season;
  const fc = useMemo(() => frameColours(season), [season]);
  const [frameCol, setFrameCol] = useState<FrameColour>(fc.colours[0]);

  const res = useMemo(() => {
    if (kind === "hair") return suggestHair(profile).find((r) => r.item.id === id) as Result<HairStyle> | undefined;
    if (kind === "beard") return suggestBeards(profile).find((r) => r.item.id === id) as Result<BeardStyle> | undefined;
    return suggestFrames(profile).find((r) => r.item.id === id) as Result<FrameStyle> | undefined;
  }, [kind, id, profile]);
  if (!res) return <Overlay title="Style" onBack={pop}><div className="empty">That style isn't available any more.</div></Overlay>;
  const it = res.item as HairStyle & BeardStyle & FrameStyle;
  const saved = profile.grooming.saved.find((s) => s.kind === kind && s.id === id);
  const text = kind === "glasses" ? "" : barberText(profile, kind, id);

  async function toggleSave() {
    const list = saved ? profile.grooming.saved.filter((s) => s !== saved) : [...profile.grooming.saved, { kind, id } as SavedStyle];
    await saveProfile({ ...profile, grooming: { ...profile.grooming, saved: list } });
    toast(saved ? "Removed from saved" : "Saved");
  }
  async function attachRef(f: File) {
    const up = await api.upload(await downscaleJpeg(f, 1200));
    const list: SavedStyle[] = saved ? profile.grooming.saved.map((s) => (s === saved ? { ...s, refImage: up.image } : s)) : [...profile.grooming.saved, { kind, id, refImage: up.image }];
    await saveProfile({ ...profile, grooming: { ...profile.grooming, saved: list } });
    toast("Reference photo added");
  }
  async function copy() {
    const body = `${text}${saved?.note ? `\n\nNote: ${saved.note}` : ""}`;
    try { await navigator.clipboard.writeText(body); toast("Copied — paste it into a message or note"); } catch { toast("Couldn't copy on this browser"); }
  }
  async function share() {
    if (navigator.share) { try { await navigator.share({ title: it.name, text }); } catch { /* cancelled */ } } else copy();
  }
  const who = profile.basics.direction === "Menswear" ? "men " : profile.basics.direction === "Womenswear" ? "women " : "";
  const piece: Piece = { id: `glasses-${id}-${frameCol.hex}`, name: `${frameCol.name} ${it.name.toLowerCase()} glasses`, category: "Accessories", colorName: frameCol.name, colorHex: frameCol.hex, pattern: "solid", fit: "", query: `${who}${it.name.toLowerCase().replace(/ \/.*$/, "")} glasses frames ${frameCol.name.toLowerCase()}` };

  return (
    <Overlay title={it.name} onBack={pop} right={<button className="chip" onClick={toggleSave}>{saved ? "♥ Saved" : "♡ Save"}</button>}>
      <div style={{ background: "var(--stage)", margin: "4px 20px 0", borderRadius: 20, display: "grid", placeItems: "center", padding: "10px 0 0", overflow: "hidden" }}>
        <Portrait face={profile.face.shape} skin={skin} hairColour={hairColour} width={220} hair={kind === "hair" ? it.illus : null} beard={kind === "beard" ? it.illus : null} frame={kind === "glasses" ? id : null} frameColour={frameCol.hex} />
      </div>
      <div className="xs muted" style={{ textAlign: "center", margin: "6px 24px 0" }}>Illustration — approximate. Drawn on your face shape{profile.face.shape ? ` (${profile.face.shape})` : ""}.</div>

      <div className="sec" style={{ paddingTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <b className="h-l" style={{ fontSize: 22 }}>{res.score}% match</b>
          {kind === "hair" && <span className="xs muted">{it.group} · trim every ~{it.trimWeeks} weeks</span>}
          {kind === "beard" && <span className="xs muted">tidy every ~{it.trimDays} days</span>}
          {kind === "glasses" && <span className="xs muted">{it.look}</span>}
        </div>
        <ul style={{ listStyle: "none", fontSize: 13.5, lineHeight: 1.5, marginTop: 8 }}>
          {res.reasons.map((t, i) => <li key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}><span style={{ color: "var(--good)" }}>●</span><span>{t.replace(/ \(\w+ face\)$/, "")}.</span></li>)}
          {res.cautions.map((t, i) => <li key={"c" + i} style={{ display: "flex", gap: 8, marginBottom: 4 }}><span style={{ color: "var(--warn)" }}>▲</span><span>{t}.</span></li>)}
        </ul>
        {res.reasons.length === 0 && res.cautions.length === 0 && <p className="sm muted">Set up your face shape{kind === "hair" ? " and hair type" : ""} for specific reasons.</p>}
      </div>

      {kind === "glasses" ? (
        <div className="sec">
          <h3>Colours for you</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {fc.colours.map((c) => <button key={c.name} onClick={() => setFrameCol(c)} aria-label={c.name} style={{ display: "grid", justifyItems: "center", gap: 4, background: "none", border: 0 }}><span className="sw" style={{ width: 38, height: 38, background: c.hex, boxShadow: frameCol.name === c.name ? "0 0 0 2.5px var(--ink)" : "inset 0 0 0 1px rgba(0,0,0,.15)" }} /><span className="xs">{c.name}</span></button>)}
          </div>
          <p className="xs muted" style={{ marginTop: 8, lineHeight: 1.5 }}>{fc.note}</p>
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            <button className="btn dark full" onClick={() => push({ t: "glassesphoto", frame: id })}>Try this on my photo</button>
            <button className="btn light full" onClick={() => push({ t: "findpiece", piece })}>Find frames to buy</button>
          </div>
        </div>
      ) : (
        <>
          <div className="sec">
            <h3>Preview in another colour</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {HAIR_COLOURS.map((c) => <button key={c} aria-label={`Hair ${c}`} onClick={() => setHairColour(c)} className="sw" style={{ background: c, width: 30, height: 30, boxShadow: hairColour === c ? "0 0 0 2.5px var(--ink)" : "inset 0 0 0 1px rgba(0,0,0,.12)" }} />)}
            </div>
          </div>
          <div className="sec">
            <h3>Take this to your {kind === "hair" ? "stylist" : "barber"}</h3>
            <div className="card" style={{ padding: 14 }}>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--sans)", fontSize: 13.5, lineHeight: 1.55 }}>{text}</pre>
              {saved?.refImage && <Img name={saved.refImage} alt="Reference" style={{ width: "100%", borderRadius: 14, marginTop: 10, maxHeight: 280, objectFit: "cover" }} />}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn dark sm" style={{ flex: 1 }} onClick={copy}>Copy</button>
              <button className="btn light sm" style={{ flex: 1 }} onClick={share}>Share</button>
              <label className="btn light sm" style={{ flex: 1, cursor: "pointer" }}>{saved?.refImage ? "Change photo" : "Add reference photo"}<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) attachRef(f); }} /></label>
            </div>
            <p className="xs muted" style={{ marginTop: 8, lineHeight: 1.5 }}>Terms and lengths are typical guides — show your stylist a photo you like as well, and let them adjust for your hair in person.</p>
          </div>
          {(it.tips?.length ?? 0) > 0 && (
            <div className="sec" style={{ paddingBottom: 16 }}><h3>Day to day</h3>{it.tips.map((t: string, i: number) => <div key={i} className="sm" style={{ marginBottom: 4, lineHeight: 1.5 }}>• {t}</div>)}</div>
          )}
        </>
      )}
      {kind === "glasses" && <div style={{ height: 12 }} />}
    </Overlay>
  );
}

export function GroomingCard() {
  const { profile, push } = useStore();
  const { skin, hairColour } = usePortraitColours();
  const top = useMemo(() => suggestHair(profile)[0], [profile]);
  return (
    <div className="sec">
      <h3>Hair, beard &amp; glasses</h3>
      <div className="card" style={{ padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ background: "var(--stage)", borderRadius: 14, overflow: "hidden", width: 72, flex: "none" }}><Portrait face={profile.face.shape} skin={skin} hairColour={hairColour} width={72} hair={profile.face.shape ? top.item.illus : null} /></div>
        <div style={{ flex: 1 }}>
          <b style={{ fontSize: 15 }}>Styles for your face</b>
          <div className="xs muted" style={{ lineHeight: 1.45, margin: "2px 0 8px" }}>{profile.face.shape ? `Matched to your ${profile.face.shape} face, hair and colouring.` : "Find your face shape to get matched suggestions."}</div>
          <button className="btn dark sm" onClick={() => push({ t: "grooming" })}>Explore</button>
        </div>
      </div>
    </div>
  );
}
