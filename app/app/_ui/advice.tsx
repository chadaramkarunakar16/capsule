"use client";
import { useEffect, useMemo, useState } from "react";
import { api, type Advice } from "@/lib/api";
import { BEARDS, FRAMES, HAIRSTYLES } from "@/lib/grooming/catalog";
import { BUILD_KNOWLEDGE, FACE_KNOWLEDGE, HEIGHT_KNOWLEDGE } from "@/lib/knowledge";
import { buildOf, heightBand } from "@/lib/style/build";
import { Overlay } from "./ui";
import { useStore } from "./store";

type Topic = "grooming" | "outfits";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What Capsule can already say from your profile, without any AI call. This is the same knowledge the AI reads first. */
function Known({ topic }: { topic: Topic }) {
  const { profile: p } = useStore();
  const fs = p.face.shape, bk = buildOf(p), hb = heightBand(p.basics.height);
  const rows: [string, string][] = [];
  if (topic === "grooming" && fs) {
    const k = FACE_KNOWLEDGE[fs];
    rows.push(["Your face", `${cap(fs)}. ${k.traits}`], ["Hair", `${k.hair.works} Skip: ${k.hair.avoid}`], ["Beard", `${k.beard.works} Skip: ${k.beard.avoid}`], ["Glasses", `${k.glasses.works} Skip: ${k.glasses.avoid}`], ["Sunglasses", k.sunglasses]);
  }
  if (topic === "outfits") {
    if (bk) { const k = BUILD_KNOWLEDGE[bk.key]; rows.push([`Your build (${bk.key})`, k.what], ["What works", k.wear.join(" ")], ["Fabrics", k.fabrics]); }
    if (hb) rows.push(["Your height", HEIGHT_KNOWLEDGE[hb]]);
    if (fs) rows.push(["Necklines", FACE_KNOWLEDGE[fs].neckline]);
  }
  if (!rows.length) return null;
  return (
    <details className="card" style={{ padding: "12px 16px", margin: "0 0 14px" }}>
      <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>What Capsule already knows about you</summary>
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {rows.map(([h, t]) => <div key={h}><div className="xs muted" style={{ fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase" }}>{h}</div><div className="sm" style={{ lineHeight: 1.5 }}>{t}</div></div>)}
      </div>
    </details>
  );
}

export function StylistAdvice({ topic: initial }: { topic: Topic }) {
  const { profile: p, items, pop, push, toast, itemById } = useStore();
  const [topic, setTopic] = useState<Topic>(initial);
  const [occasion, setOccasion] = useState("");
  const [usePhoto, setUsePhoto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Partial<Record<Topic, { advice: Advice; usedPhoto?: boolean }>>>({});
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => { api.settings().then((s) => setReady(s.aiAvailable)).catch(() => setReady(false)); }, []);

  const missing = useMemo(() => {
    const m: string[] = [];
    if (topic === "grooming") { if (!p.face.shape) m.push("a face photo or face shape"); if (!p.grooming.hairType) m.push("hair type (in Hair, beard & glasses)"); }
    else { if (!p.basics.height) m.push("height"); if (!buildOf(p)) m.push("weight or the build slider on your avatar"); if (!p.color.season) m.push("your colouring"); if (!p.body.shoulderHip && !p.body.torsoLeg) m.push("your proportions"); if (!items.length) m.push("a few pieces in your closet"); }
    return m;
  }, [topic, p, items.length]);

  async function ask() {
    setBusy(true); setErr(null);
    try {
      const r = await api.advice({ topic, occasion: topic === "outfits" ? occasion : undefined, useFacePhoto: topic === "grooming" && usePhoto && !!p.avatar.facePhoto });
      if (!r.available || !r.advice) throw new Error("Add your Gemini key under Me → AI first.");
      setRes((cur) => ({ ...cur, [topic]: { advice: r.advice!, usedPhoto: r.usedPhoto } }));
    } catch (e) { setErr(e instanceof Error ? e.message : "The stylist couldn’t answer"); }
    setBusy(false);
  }

  const shown = res[topic];
  const nameOf = (kind: "hair" | "beard" | "glasses", id: string) => (kind === "hair" ? HAIRSTYLES : kind === "beard" ? BEARDS : FRAMES).find((x) => x.id === id)?.name ?? id;
  const style = (kind: "hair" | "beard" | "glasses", list?: { id: string; why: string }[]) => !list?.length ? null : (
    <div className="ctl-group">
      <h3>{kind === "hair" ? "Hair" : kind === "beard" ? "Facial hair" : "Glasses"}</h3>
      {list.map((x) => (
        <button key={x.id} className="line" style={{ padding: 0, alignItems: "flex-start" }} onClick={() => push({ t: "groomstyle", kind, id: x.id })}>
          <span><b>{nameOf(kind, x.id)}</b><span className="sm" style={{ lineHeight: 1.5 }}>{x.why}</span></span><span aria-hidden>›</span>
        </button>
      ))}
    </div>
  );

  return (
    <Overlay title="Your stylist" onBack={pop}>
      <div className="ctl" style={{ paddingTop: 6 }}>
        <div className="seg" style={{ margin: 0 }}>
          <button className={topic === "grooming" ? "on" : ""} onClick={() => setTopic("grooming")}>Hair, beard &amp; glasses</button>
          <button className={topic === "outfits" ? "on" : ""} onClick={() => setTopic("outfits")}>Outfits</button>
        </div>

        <p className="sm muted" style={{ lineHeight: 1.5 }}>
          {topic === "grooming"
            ? "The stylist reads Capsule’s notes on your face shape, hair and grooming first, looks at your face photo if you kept one, then picks from the styles in this app and explains why for you."
            : "The stylist reads Capsule’s notes on your build, height, proportions and colouring first, then looks at your closet. A lean frame gets layering ideas; a fuller frame gets clean, tonal lines; shorter and taller frames get length advice."}
        </p>

        <Known topic={topic} />

        {missing.length > 0 && <div className="card" style={{ padding: "10px 14px", fontSize: 13, lineHeight: 1.5, background: "#fff8ea", borderColor: "#f1deb2" }}>Better with: {missing.join(", ")}. <button className="linkish" onClick={() => push({ t: "avatar" })}>Add in My avatar and face</button></div>}

        {topic === "grooming" && p.avatar.facePhoto && (
          <label className="job" style={{ cursor: "pointer", padding: 0 }}><input type="checkbox" checked={usePhoto} onChange={(e) => setUsePhoto(e.target.checked)} /><span>Let the stylist look at my saved face photo <span className="muted xs">(sent to Google only now)</span></span></label>
        )}
        {topic === "outfits" && <input className="input" placeholder="Occasion (optional), e.g. dinner, office, trip" value={occasion} onChange={(e) => setOccasion(e.target.value)} />}

        <div>
          <button className="btn dark" disabled={busy || ready === false} onClick={ask}>{busy ? "Thinking…" : shown ? "Ask again" : "Get my advice"}</button>
          {ready === false && <p className="xs" style={{ color: "var(--danger)", marginTop: 6 }}>Add a Gemini key under Me → AI to use the stylist. The notes above work without one.</p>}
          {err && <p className="sm" style={{ color: "var(--danger)", marginTop: 6, lineHeight: 1.4 }}>{err}</p>}
        </div>

        {shown && (
          <>
            <div className="card" style={{ padding: 14 }}>
              <b style={{ fontSize: 15 }}>For you</b>
              <p className="sm" style={{ lineHeight: 1.55, marginTop: 4 }}>{shown.advice.summary}</p>
              {shown.usedPhoto && <p className="xs muted" style={{ marginTop: 6 }}>Includes what the stylist could see in your face photo.</p>}
            </div>
            {topic === "grooming" ? (
              <>
                {style("hair", shown.advice.hair)}
                {style("beard", shown.advice.beard)}
                {style("glasses", shown.advice.glasses)}
                {shown.advice.sunglasses && <div className="ctl-group"><h3>Sunglasses</h3><p className="sm" style={{ lineHeight: 1.5 }}>{shown.advice.sunglasses}</p></div>}
                {!!shown.advice.tips?.length && <div className="ctl-group"><h3>Tips</h3><ul className="sm" style={{ paddingLeft: 18, lineHeight: 1.6 }}>{shown.advice.tips.map((t) => <li key={t}>{t}</li>)}</ul></div>}
              </>
            ) : (
              <>
                {!!shown.advice.do?.length && <div className="ctl-group"><h3>Do</h3><ul className="sm" style={{ paddingLeft: 18, lineHeight: 1.6 }}>{shown.advice.do.map((t) => <li key={t}>{t}</li>)}</ul></div>}
                {!!shown.advice.avoid?.length && <div className="ctl-group"><h3>Gently avoid</h3><ul className="sm" style={{ paddingLeft: 18, lineHeight: 1.6 }}>{shown.advice.avoid.map((t) => <li key={t}>{t}</li>)}</ul></div>}
                {!!shown.advice.outfits?.length && (
                  <div className="ctl-group">
                    <h3>Outfits from your closet</h3>
                    {shown.advice.outfits.map((o) => {
                      const ids = o.items.map((n) => items.find((i) => (i.name || i.category) === n)?.id).filter((x): x is string => !!x);
                      return (
                        <button key={o.name} className="line" style={{ padding: 0, alignItems: "flex-start" }} disabled={ids.length < 2} onClick={() => { if (ids.length >= 2) push({ t: "outfit", itemIds: ids }); else toast("Those pieces are no longer in your closet"); }}>
                          <span><b>{o.name}</b><span className="xs muted">{ids.map((i) => itemById[i]?.name || itemById[i]?.category).join(" + ")}</span><span className="sm" style={{ lineHeight: 1.5 }}>{o.why}</span></span><span aria-hidden>›</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            <p className="xs muted" style={{ lineHeight: 1.5 }}>Advice is guidance from general styling practice and what you’ve told Capsule — not a rule, and not a judgement of you. Wear what you like.</p>
          </>
        )}
      </div>
    </Overlay>
  );
}

/** Entry card for the Me tab. */
export function StylistCard() {
  const { push } = useStore();
  return (
    <div className="sec">
      <h3>Your stylist</h3>
      <div className="card" style={{ padding: 14 }}>
        <b style={{ fontSize: 15 }}>Advice built on your face, build and colouring</b>
        <p className="xs muted" style={{ lineHeight: 1.5, margin: "4px 0 10px" }}>Hairstyles, beards and glasses for your face shape; layering and fits for your build and height; outfits from your own closet.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn dark sm" onClick={() => push({ t: "advice", topic: "grooming" })}>Hair, beard &amp; glasses</button>
          <button className="btn light sm" onClick={() => push({ t: "advice", topic: "outfits" })}>Outfits</button>
        </div>
      </div>
    </div>
  );
}
