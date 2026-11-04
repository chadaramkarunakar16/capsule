"use client";
import { useRef, useState } from "react";
import { analyseFacePhoto, analyseBodyPhoto } from "@/lib/vision";
import { combine, readPhoto, type PhotoReading, type QuizAnswers } from "@/lib/style/analysis";
import { LABELS, fromMeasurements, type Body, type Measurements } from "@/lib/style/body";
import { FACE_BLURB, FACE_SHAPES, classifyFace, type FaceRatios, type FaceShape } from "@/lib/style/face";
import { AIMS, completion, normalizeProfile, status, type Profile } from "@/lib/style/profile";
import { SEASONS, seasonByKey } from "@/lib/style/seasons";
import type { Fit } from "@/lib/style/score";
import { hexToRgb, median, medianRgb, rgbToHex } from "@/lib/style/color";
import { Overlay, Chips } from "./ui";
import { AvatarFigure } from "./avatar";
import { MyPhotos, useFigureWidth, useWide } from "./my-photos";
import { useStore } from "./store";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pct = (n: number) => `${Math.round(n * 100)}%`;

/* ------------------------------------------------------------------ shared bits */

export function Swatches({ colors, size = 34 }: { colors: string[]; size?: number }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {colors.map((c) => (
        <span key={c} title={c} style={{ width: size, height: size, borderRadius: "50%", background: c, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)", display: "inline-block" }} />
      ))}
    </div>
  );
}

/** Score + reasons, with a nudge for whatever is still missing from the profile. */
export function FitCard({ fit, title = "How it suits you", hideEmpty, max }: { fit: Fit; title?: string; hideEmpty?: boolean; max?: number }) {
  const { push } = useStore();
  const section = fit.needs.includes("colour") ? "color" : fit.needs.includes("proportions") ? "body" : fit.needs.includes("face shape") ? "face" : null;
  const tone = fit.score >= 80 ? "var(--good)" : fit.score >= 65 ? "var(--ink)" : "var(--warn)";
  if (hideEmpty && !fit.reasons.length && !fit.needs.length) return null;
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="xs muted" style={{ fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" }}>{title}</span>
        <span><b className="h-l" style={{ color: tone }}>{fit.score}%</b> <span className="sm muted">{fit.label}</span></span>
      </div>
      <div className="prog" style={{ margin: "8px 0 10px" }}><i style={{ width: `${fit.score}%`, background: tone }} /></div>
      {fit.reasons.length ? (
        <ul style={{ listStyle: "none", fontSize: 13.5, lineHeight: 1.5 }}>
          {(max ? fit.reasons.slice(0, max) : fit.reasons).map((r, i) => (
            <li key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
              <span style={{ color: r.delta < 0 ? "var(--warn)" : "var(--good)", flex: "none" }}>{r.delta < 0 ? "▲" : "●"}</span>
              <span>{r.text}.</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="sm muted">No strong signals yet.</div>
      )}
      {fit.needs.length > 0 && (
        <div className="xs muted" style={{ marginTop: 8, lineHeight: 1.5 }}>
          Sharper with: {fit.needs.join(", ")}.{" "}
          {section && <button className="chip" style={{ height: 26, fontSize: 12 }} onClick={() => push({ t: "style", section })}>Set up</button>}
        </div>
      )}
    </div>
  );
}

export function SetupBanner() {
  const { profile, push } = useStore();
  if (completion(profile) >= 2 && profile.color.season) return null;
  return (
    <button className="card" onClick={() => push({ t: "style", section: "all" })} style={{ margin: "12px 20px 0", padding: "12px 16px", width: "calc(100% - 40px)", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f3f0ff", borderColor: "#e0d9fb" }}>
      <span><b>Set up your style profile</b><br /><span className="xs muted">Colour, proportions and face shape — so every piece can say how it suits you</span></span>
      <span>›</span>
    </button>
  );
}

/* ------------------------------------------------------------------ palette */

export function PaletteView() {
  const { profile, pop, push } = useStore();
  const season = seasonByKey(profile.color.season);
  return (
    <Overlay title="Your palette" onBack={pop}>
      {!season ? (
        <div className="empty"><h3>No palette yet</h3>Do the colour analysis to see your best colours.
          <div style={{ marginTop: 16 }}><button className="btn dark" onClick={() => push({ t: "style", section: "color" })}>Start colour analysis</button></div></div>
      ) : (
        <>
          <div className="sec" style={{ paddingTop: 8 }}>
            <div className="xs muted" style={{ letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 600 }}>{season.family}</div>
            <h1 className="title" style={{ marginBottom: 4 }}>{season.name}</h1>
            <p className="sm muted" style={{ lineHeight: 1.5 }}>{season.blurb}</p>
            {profile.color.auto && !profile.color.overridden && (
              <p className="xs muted" style={{ marginTop: 6 }}>Estimated with {pct(profile.color.auto.confidence)} confidence — a starting point, not a verdict.</p>
            )}
            {profile.color.overridden && <p className="xs muted" style={{ marginTop: 6 }}>Chosen by you.</p>}
          </div>
          <div className="sec"><h3>Best colours</h3><Swatches colors={season.best} size={44} /></div>
          <div className="sec"><h3>Neutrals</h3><Swatches colors={season.neutrals} size={44} /></div>
          <div className="sec"><h3>Use sparingly near your face</h3><Swatches colors={season.avoid} size={44} />
            <p className="xs muted" style={{ marginTop: 10, lineHeight: 1.5 }}>These aren’t forbidden — they just tend to wash out or overpower this colouring. Wear them lower down (trousers, shoes) or with a flattering colour near the face.</p></div>
          <div className="sec" style={{ paddingBottom: 12 }}>
            <button className="btn light full" onClick={() => push({ t: "style", section: "color" })}>Redo or change</button>
          </div>
        </>
      )}
    </Overlay>
  );
}

/* ------------------------------------------------------------------ setup flow */

type Section = "basics" | "body" | "color" | "face";
const ORDER: Section[] = ["basics", "body", "color", "face"];
const TITLES: Record<Section, string> = { basics: "About you", body: "Proportions", color: "Colour", face: "Face shape" };

export function StyleSetup({ section }: { section: "all" | Section }) {
  const { profile, saveProfile, pop, push, toast } = useStore();
  const wide = useWide();
  const figW = useFigureWidth(70);
  const steps: Section[] = section === "all" ? ORDER : [section];
  const [i, setI] = useState(0);
  const [p, setP] = useState<Profile>(() => normalizeProfile(JSON.parse(JSON.stringify(profile))));
  const [busy, setBusy] = useState(false);
  const cur = steps[i];
  const last = i === steps.length - 1;

  async function next() {
    setBusy(true);
    try {
      await saveProfile(p);
      if (last) { toast("Style profile saved"); pop(); } else setI(i + 1);
    } catch (e) { toast(e instanceof Error ? e.message : "Could not save"); }
    setBusy(false);
  }

  return (
    <Overlay
      title={steps.length > 1 ? `${TITLES[cur]} · ${i + 1}/${steps.length}` : TITLES[cur]}
      onBack={() => (i > 0 ? setI(i - 1) : pop())}
      foot={
        <>
          {steps.length > 1 && !last && <button className="btn light" disabled={busy} onClick={() => setI(i + 1)}>Skip</button>}
          <button className="btn dark" style={{ flex: 1 }} disabled={busy} onClick={next}>{last ? "Save" : "Save & continue"}</button>
        </>
      }
    >
      <div className={wide ? "split" : undefined}>
        {wide && (
          <div className="split-fig">
            <div className="split-stage"><AvatarFigure profile={p} width={figW} /></div>
            <div className="xs muted" style={{ textAlign: "center", margin: "6px 0 10px" }}>Your avatar — it updates as you answer</div>
            <button className="btn light sm" style={{ width: "100%" }} onClick={() => push({ t: "avatar" })}>Fine-tune avatar and add photos</button>
          </div>
        )}
        <div>
          {cur === "basics" && <Basics p={p} setP={setP} />}
          {cur === "body" && <BodyStep p={p} setP={setP} />}
          {cur === "color" && <ColourStep p={p} setP={setP} />}
          {cur === "face" && <FaceStep p={p} setP={setP} />}
        </div>
      </div>
    </Overlay>
  );
}

type SP = { p: Profile; setP: (p: Profile) => void };

function Basics({ p, setP }: SP) {
  const b = p.basics;
  const set = (x: Partial<Profile["basics"]>) => setP({ ...p, basics: { ...b, ...x } });
  const num = (v: string) => (v === "" ? null : Number(v) || null);
  const toggleAim = (a: (typeof AIMS)[number]) => {
    if (a === "No particular goal") return set({ aims: b.aims.includes(a) ? [] : [a] });
    const base = b.aims.filter((x) => x !== "No particular goal");
    set({ aims: base.includes(a) ? base.filter((x) => x !== a) : [...base, a] });
  };
  return (
    <div className="sec" style={{ paddingTop: 8 }}>
      <p className="sm muted" style={{ marginBottom: 16, lineHeight: 1.5 }}>Everything here is optional and stays on this computer. It’s used only to explain what flatters you — never to judge.</p>
      <div className="fgrid" style={{ marginBottom: 18 }}>
        <div><label className="f">Height (cm)</label><input className="input" inputMode="numeric" value={b.height ?? ""} onChange={(e) => set({ height: num(e.target.value) })} /></div>
        <div><label className="f">Weight (kg, optional)</label><input className="input" inputMode="numeric" value={b.weight ?? ""} onChange={(e) => set({ weight: num(e.target.value) })} /></div>
      </div>
      <p className="xs muted" style={{ margin: "-8px 0 18px" }}>Weight is kept for the avatar later. It doesn’t affect any clothing score.</p>
      <label className="f">Style direction</label>
      <Chips options={["Menswear", "Womenswear", "Mixed", "Androgynous"] as const} value={b.direction} onPick={(v) => set({ direction: v ?? "" })} />
      <label className="f" style={{ marginTop: 18 }}>How do you like clothes to fit?</label>
      <Chips options={["Tailored", "Relaxed", "Mix of both"] as const} value={b.fit} onPick={(v) => set({ fit: v ?? "" })} />
      <label className="f" style={{ marginTop: 18 }}>What would you like clothes to do for you?</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {AIMS.map((a) => (
          <button key={a} className={`chip ${b.aims.includes(a) ? "on" : ""}`} onClick={() => toggleAim(a)}>{a}</button>
        ))}
      </div>
    </div>
  );
}

function BodyStep({ p, setP }: SP) {
  const { toast } = useStore();
  const [mode, setMode] = useState<"measure" | "photo" | "describe">("measure");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const m = p.measurements;
  const setM = (x: Partial<Measurements>) => setP({ ...p, measurements: { ...m, ...x } });
  const num = (v: string) => (v === "" ? null : Number(v) || null);
  const setBody = (x: Partial<Body>) => setP({ ...p, body: { ...p.body, ...x, source: p.body.source ?? "self" } });

  function calc() {
    const b = fromMeasurements(m, p.basics.height);
    if (!b.shoulderHip && !b.torsoLeg && !b.waist) return toast("Enter at least chest and hip");
    setP({ ...p, body: { ...p.body, ...b, shoulderHip: b.shoulderHip ?? p.body.shoulderHip, torsoLeg: b.torsoLeg ?? p.body.torsoLeg, waist: b.waist ?? p.body.waist } });
    setNote("Worked out from your measurements — adjust below if it doesn’t feel right.");
  }
  async function onPhoto(f: File) {
    setBusy(true); setNote(null);
    try {
      const r = await analyseBodyPhoto(f);
      if (!r.ok) setNote(r.reason);
      else {
        setP({ ...p, body: { ...p.body, shoulderHip: r.body.shoulderHip, torsoLeg: r.body.torsoLeg, source: "photo", ratios: r.body.ratios } });
        setNote(["Estimated from your photo (stays on this device). Camera angle and clothing affect this — check the result below.", ...r.problems].join(" "));
      }
    } catch (e) { setNote(e instanceof Error ? `Couldn't run the pose model: ${e.message}` : "Couldn't run the pose model."); }
    setBusy(false);
  }

  return (
    <div className="sec" style={{ paddingTop: 8 }}>
      <p className="sm muted" style={{ marginBottom: 14, lineHeight: 1.5 }}>This is about what <i>you</i> want to emphasise or balance — there are no “good” or “bad” proportions. Pick any way to start, then fine-tune.</p>
      <div className="seg" style={{ margin: "0 0 16px" }}>
        <button className={mode === "measure" ? "on" : ""} onClick={() => setMode("measure")}>Measure</button>
        <button className={mode === "photo" ? "on" : ""} onClick={() => setMode("photo")}>Photo</button>
        <button className={mode === "describe" ? "on" : ""} onClick={() => setMode("describe")}>Just tell me</button>
      </div>

      {mode === "measure" && (
        <>
          <div className="fgrid">
            {([["chest", "Chest / bust (cm)"], ["waist", "Waist (cm)"], ["hip", "Hip, widest part (cm)"], ["inseam", "Inseam (cm)"]] as const).map(([k, l]) => (
              <div key={k}><label className="f">{l}</label><input className="input" inputMode="decimal" value={m[k] ?? ""} onChange={(e) => setM({ [k]: num(e.target.value) })} /></div>
            ))}
          </div>
          <p className="xs muted" style={{ margin: "8px 0 12px", lineHeight: 1.5 }}>Use a soft tape over light clothing. Inseam needs your height (set in “About you”).</p>
          <button className="btn dark full" onClick={calc}>Work out my proportions</button>
        </>
      )}
      {mode === "photo" && (
        <>
          <div className="drop">Full-body photo, facing the camera, arms slightly away from the body, feet in frame.<br />
            <button className="btn dark" style={{ marginTop: 10 }} disabled={busy} onClick={() => file.current?.click()}>{busy ? "Analysing…" : "Choose photo"}</button>
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPhoto(f); }} />
          </div>
          <p className="xs muted" style={{ marginTop: 8 }}>Analysed on this device. The photo is not uploaded or saved. The first run downloads a small pose model.</p>
        </>
      )}
      {note && <div className="card" style={{ padding: 12, marginTop: 12, fontSize: 13, lineHeight: 1.5 }}>{note}</div>}

      <div style={{ marginTop: 22 }}>
        <label className="f">Shoulders vs hips</label>
        <Chips options={["broader-shoulders", "balanced", "broader-hips"] as const} value={p.body.shoulderHip} onPick={(v) => setBody({ shoulderHip: v })} labels={LABELS.shoulderHip} />
        <label className="f" style={{ marginTop: 16 }}>Torso vs legs</label>
        <Chips options={["longer-torso", "balanced", "longer-legs"] as const} value={p.body.torsoLeg} onPick={(v) => setBody({ torsoLeg: v })} labels={LABELS.torsoLeg} />
        <label className="f" style={{ marginTop: 16 }}>Waist</label>
        <Chips options={["defined", "straight"] as const} value={p.body.waist} onPick={(v) => setBody({ waist: v })} labels={LABELS.waist} />
      </div>
    </div>
  );
}

const QUIZ: { key: keyof QuizAnswers; q: string; opts: [string, string][] }[] = [
  { key: "veins", q: "Veins on your inner wrist look…", opts: [["green", "Greenish"], ["blue", "Blue / purple"], ["both", "Can’t tell"]] },
  { key: "metal", q: "Which jewellery flatters you more?", opts: [["gold", "Gold"], ["silver", "Silver"], ["both", "Both"]] },
  { key: "hair", q: "Natural hair colour (before dye)", opts: [["blonde-light", "Light blonde"], ["blonde-dark", "Dark blonde"], ["red", "Red / copper"], ["brown-light", "Light–mid brown"], ["brown-dark", "Dark brown"], ["black", "Black"]] },
  { key: "eyes", q: "Eye colour", opts: [["light-blue-grey", "Light blue / grey"], ["green-hazel", "Green / hazel"], ["brown", "Brown"], ["dark-brown", "Very dark brown"]] },
  { key: "sun", q: "In the sun, your skin…", opts: [["burn", "Burns easily"], ["tan-golden", "Tans golden"], ["tan-deep", "Tans deep"], ["freckle", "Freckles"]] },
  { key: "contrast", q: "Hair, skin and eyes look…", opts: [["high", "Very different (high contrast)"], ["medium", "Somewhat different"], ["low", "Similar (soft blend)"]] },
];

type Shot = { id: number; preview: string; reading: PhotoReading | null; ratios: FaceRatios | null; swatches: { skin: string; hair: string | null; eyes: string | null } | null; error?: string };

function ColourStep({ p, setP }: SP) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const readings = shots.map((s) => s.reading).filter((r): r is PhotoReading => !!r);
  const result = combine(readings, p.color.quiz);
  const chosen = seasonByKey(p.color.season);

  const pRef = useRef(p);
  pRef.current = p; // photo analysis is async: always merge onto the latest profile, not the one captured at click time
  function commit(next: Shot[], quiz: QuizAnswers) {
    const cur = pRef.current;
    const rs = next.map((s) => s.reading).filter((r): r is PhotoReading => !!r);
    const c = combine(rs, quiz);
    const q = { ...cur.color, quiz, photos: rs.length };
    let face = cur.face;
    const ratios = next.map((s) => s.ratios).filter((r): r is FaceRatios => !!r);
    if (ratios.length) {
      const med = { lengthToWidth: median(ratios.map((r) => r.lengthToWidth)), foreheadToCheek: median(ratios.map((r) => r.foreheadToCheek)), jawToCheek: median(ratios.map((r) => r.jawToCheek)), chinAngle: median(ratios.map((r) => r.chinAngle)) };
      const g = classifyFace(med);
      face = { ...face, auto: { shape: g.shape, confidence: g.confidence, alternatives: g.alternatives }, shape: face.overridden || face.shape ? face.shape : g.shape };
    }
    // photo-derived starting colours for the avatar (never overwrite what the user chose)
    const sw = next.map((s) => s.swatches).filter((x): x is NonNullable<typeof x> => !!x);
    const hex = (list: (string | null)[]) => { const l = list.filter((h): h is string => !!h).map(hexToRgb); return l.length ? rgbToHex(medianRgb(l)) : null; };
    const avatar = { ...cur.avatar, skin: cur.avatar.skin ?? hex(sw.map((x) => x.skin)), hair: cur.avatar.hair ?? hex(sw.map((x) => x.hair)) };
    if (c && !cur.color.overridden) setP({ ...cur, face, avatar, color: { ...q, season: c.key, auto: { key: c.key, confidence: c.confidence, alternatives: c.alternatives } } });
    else setP({ ...cur, face, avatar, color: q });
  }

  async function addPhotos(files: File[]) {
    setBusy(true);
    let next = [...shots];
    for (const f of files.slice(0, 3 - shots.length)) {
      const id = Date.now() + next.length;
      const preview = URL.createObjectURL(f);
      try {
        const r = await analyseFacePhoto(f);
        next = r.ok
          ? [...next, { id, preview, reading: readPhoto(r.samples), ratios: r.ratios, swatches: r.swatches }]
          : [...next, { id, preview, reading: null, ratios: null, swatches: null, error: r.reason }];
      } catch (e) {
        next = [...next, { id, preview, reading: null, ratios: null, swatches: null, error: e instanceof Error ? `Couldn't run the face model: ${e.message}` : "Couldn't run the face model." }];
      }
      setShots(next);
    }
    commit(next, pRef.current.color.quiz);
    setBusy(false);
  }
  function removeShot(id: number) {
    const next = shots.filter((s) => s.id !== id);
    setShots(next);
    commit(next, pRef.current.color.quiz);
  }
  function answer(k: keyof QuizAnswers, v: string) {
    const quiz = { ...p.color.quiz, [k]: p.color.quiz[k] === v ? undefined : v } as QuizAnswers;
    commit(shots, quiz);
  }
  function pickSeason(key: string) {
    const auto = p.color.auto;
    setP({ ...p, color: { ...p.color, season: key, overridden: !auto || auto.key !== key } });
  }

  return (
    <div className="sec" style={{ paddingTop: 8 }}>
      <p className="sm muted" style={{ lineHeight: 1.5, marginBottom: 12 }}>
        Colour analysis from a photo is a best guess — screens and lighting distort colour. We cross-check up to three photos and a short quiz, tell you how sure we are, and you always have the final say.
      </p>
      <div className="card" style={{ padding: 12, fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
        <b>For best results:</b> daylight by a window, no makeup, no filters, hair pulled back from your face, plain top, face the camera. Photos are analysed on this device and never saved.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {shots.map((s) => (
          <div key={s.id} style={{ position: "relative", width: 92 }}>
            <img src={s.preview} alt="" style={{ width: 92, height: 112, objectFit: "cover", borderRadius: 14, background: "#eee" }} />
            <button className="rm" style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,.92)", border: 0, fontSize: 11 }} aria-label="Remove photo" onClick={() => removeShot(s.id)}>✕</button>
            {s.swatches && <div style={{ display: "flex", gap: 3, marginTop: 4 }}><Dot c={s.swatches.skin} /><Dot c={s.swatches.hair} /><Dot c={s.swatches.eyes} /></div>}
          </div>
        ))}
        {shots.length < 3 && (
          <button className="drop" style={{ width: 92, height: 112, padding: 0, display: "grid", placeItems: "center" }} disabled={busy} onClick={() => file.current?.click()}>
            {busy ? <span className="spin" /> : <span>＋<br /><span className="xs">photo</span></span>}
          </button>
        )}
        <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; addPhotos(fs); }} />
      </div>
      {shots.some((s) => s.error) && <div className="xs" style={{ color: "var(--danger)", marginBottom: 8, lineHeight: 1.5 }}>{shots.filter((s) => s.error).map((s) => s.error).join(" ")}</div>}
      {busy && <div className="xs muted" style={{ marginBottom: 8 }}>Reading your photo… the first run downloads a small face model.</div>}

      <button className="chip" onClick={() => setQuizOpen(!quizOpen)}>{quizOpen ? "Hide" : "Add"} the 6-question quiz {p.color.quiz && Object.values(p.color.quiz).filter(Boolean).length ? `(${Object.values(p.color.quiz).filter(Boolean).length} answered)` : ""}</button>
      {quizOpen && (
        <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
          {QUIZ.map((q) => (
            <div key={q.key}>
              <label className="f">{q.q}</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {q.opts.map(([v, l]) => <button key={v} className={`chip ${p.color.quiz[q.key] === v ? "on" : ""}`} onClick={() => answer(q.key, v)}>{l}</button>)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 14, marginTop: 16 }}>
        {!result && !chosen ? (
          <div className="sm muted">Add a photo or answer at least two quiz questions to get a first estimate.</div>
        ) : (
          <>
            <div className="xs muted" style={{ letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 600 }}>{p.color.overridden ? "Your choice" : "Best estimate"}</div>
            <h2 className="h-l" style={{ margin: "2px 0" }}>{chosen?.name ?? result?.name}</h2>
            {result && !p.color.overridden && <div className="sm muted">{pct(result.confidence)} confident · {result.photos} photo{result.photos === 1 ? "" : "s"}{result.quizAnswered ? ` · ${result.quizAnswered} quiz answers` : ""}</div>}
            {chosen && <div style={{ margin: "12px 0" }}><Swatches colors={[...chosen.best.slice(0, 6), ...chosen.neutrals.slice(0, 2)]} size={30} /></div>}
            {result && !p.color.overridden && result.notes.length > 0 && <ul className="xs muted" style={{ paddingLeft: 16, lineHeight: 1.5 }}>{result.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
            {result && result.alternatives.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div className="xs muted" style={{ marginBottom: 6 }}>Also close:</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{result.alternatives.map((a) => <button key={a.key} className="chip" onClick={() => pickSeason(a.key)}>{a.name}</button>)}</div>
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="f">Know your season already? Choose it</label>
        <select className="input" value={p.color.season ?? ""} onChange={(e) => e.target.value && pickSeason(e.target.value)}>
          <option value="">—</option>
          {SEASONS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
      </div>
    </div>
  );
}

const Dot = ({ c }: { c: string | null }) => <span style={{ width: 16, height: 16, borderRadius: "50%", background: c ?? "#ddd", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)", display: "inline-block", opacity: c ? 1 : 0.35 }} />;

function FaceStep({ p, setP }: SP) {
  const auto = p.face.auto;
  return (
    <div className="sec" style={{ paddingTop: 8 }}>
      <p className="sm muted" style={{ lineHeight: 1.5, marginBottom: 12 }}>Face shape helps with necklines and collars, and with glasses, hair and beard styles. It uses the same face photo as <b>My avatar and face</b> — add it once and everything stays in step. Hair pulled back, neutral expression, facing the camera.</p>
      <MyPhotos p={p} setP={setP} kinds={["face"]} />
      {auto && <div className="sm muted" style={{ marginTop: 12 }}>Estimate: <b style={{ color: "var(--ink)" }}>{cap(auto.shape)}</b> ({pct(auto.confidence)}); also close: {auto.alternatives.map(cap).join(", ")}.</div>}
      <label className="f" style={{ marginTop: 18 }}>Your face shape</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {FACE_SHAPES.map((s: FaceShape) => (
          <button key={s} className={`chip ${p.face.shape === s ? "on" : ""}`} onClick={() => setP({ ...p, face: { ...p.face, shape: p.face.shape === s ? null : s, overridden: true } })}>{cap(s)}</button>
        ))}
      </div>
      {p.face.shape && <p className="sm" style={{ marginTop: 12, lineHeight: 1.5 }}>{FACE_BLURB[p.face.shape]}</p>}
      <label className="job" style={{ marginTop: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={p.face.wearsGlasses} onChange={(e) => setP({ ...p, face: { ...p.face, wearsGlasses: e.target.checked } })} />
        <span>I wear glasses <span className="muted xs">(for frame suggestions)</span></span>
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ profile hub (used on the Me tab) */

export function StyleHub() {
  const { profile, push } = useStore();
  const st = status(profile);
  const season = seasonByKey(profile.color.season);
  const body = [profile.body.shoulderHip && LABELS.shoulderHip[profile.body.shoulderHip], profile.body.torsoLeg && LABELS.torsoLeg[profile.body.torsoLeg]].filter(Boolean).join(" · ");
  const rows: { s: Section; label: string; value: string | null }[] = [
    { s: "basics", label: "About you", value: st.basics ? [profile.basics.height && `${profile.basics.height} cm`, profile.basics.fit, profile.basics.direction].filter(Boolean).join(" · ") || "Saved" : null },
    { s: "body", label: "Proportions", value: st.body ? body || "Saved" : null },
    { s: "color", label: "Colour", value: season ? `${season.name}${profile.color.overridden ? "" : profile.color.auto ? ` · ${pct(profile.color.auto.confidence)} sure` : ""}` : null },
    { s: "face", label: "Face shape", value: profile.face.shape ? cap(profile.face.shape) : null },
  ];
  return (
    <div className="card">
      {rows.map((r, k) => (
        <button key={r.s} className="line" style={{ width: "100%", textAlign: "left", background: "none", borderTop: 0, borderLeft: 0, borderRight: 0, borderBottom: k === rows.length - 1 ? 0 : "1px solid var(--line)" }} onClick={() => push({ t: "style", section: r.s })}>
          <span><b style={{ fontSize: 15 }}>{r.label}</b><br /><span className={`xs ${r.value ? "" : "muted"}`}>{r.value ?? "Not set up yet"}</span></span>
          <span className={`pill ${r.value ? "ai" : "guess"}`}>{r.value ? "Edit" : "Set up"}</span>
        </button>
      ))}
      <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--line)" }}>
        <button className="btn dark sm" style={{ flex: 1 }} onClick={() => push({ t: "style", section: "all" })}>{completion(profile) ? "Walk through all" : "Start — takes 3 minutes"}</button>
        {season && <button className="btn light sm" onClick={() => push({ t: "palette" })}>My palette</button>}
      </div>
    </div>
  );
}
