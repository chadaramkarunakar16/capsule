"use client";
import { useEffect, useRef, useState } from "react";
import { imageUrl } from "@/lib/engine";
import { imgPath } from "@/lib/api";
import { Img } from "./ui";
import { analyseBodyPhoto, analyseFacePhoto } from "@/lib/analyse";
import { applyBodyPhoto, applyFacePhoto } from "@/lib/style/apply";
import type { Profile } from "@/lib/style/profile";
import { api } from "@/lib/api";
import { downscaleJpeg } from "@/lib/image";

/** True on laptop-sized windows (matches the desktop layout breakpoint). */
export function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 900px)");
    const f = () => setWide(m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return wide;
}

/** Width for the live avatar so the whole figure fits the window height (the figure is 2.25x as tall as wide). */
export function useFigureWidth(extra = 0) {
  const wide = useWide();
  const [h, setH] = useState(800);
  useEffect(() => {
    const f = () => setH(window.innerHeight);
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return wide ? Math.max(110, Math.min(300, Math.floor((h - 190 - extra) / 2.25))) : 110;
}

type Kind = "face" | "body";

/**
 * "Add my photos": a face photo and a full-body photo, read by your AI service for one question (not stored).
 * Results go straight into the profile draft, so the style questions, the avatar and the face screens stay in step.
 */
export function MyPhotos({ p, setP, kinds = ["face", "body"] }: { p: Profile; setP: (next: Profile) => void; kinds?: Kind[] }) {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [notes, setNotes] = useState<Partial<Record<Kind, { ok: boolean; lines: string[] }>>>({});
  const [thumb, setThumb] = useState<Partial<Record<Kind, string>>>({});
  const [files, setFiles] = useState<Partial<Record<Kind, File>>>({});
  const [saving, setSaving] = useState<Kind | null>(null);
  const face = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLInputElement>(null);
  const latest = useRef(p);
  latest.current = p; // analysis is async: always apply onto the newest draft

  // a face photo kept earlier but never analysed (for example added before this version) is read once, so the face
  // shape, skin and hair colour on every screen come from it without asking again
  const autoRan = useRef(false);
  useEffect(() => {
    const name = p.avatar.facePhoto;
    if (autoRan.current || !name || p.face.auto || !kinds.includes("face")) return;
    autoRan.current = true;
    (async () => {
      try {
        const blob = await (await fetch(await imageUrl(imgPath(name)))).blob();
        const r = await analyseFacePhoto(blob);
        if (!r.ok) { setNotes((n) => ({ ...n, face: { ok: false, lines: [r.reason] } })); return; }
        const a = applyFacePhoto(latest.current, r);
        setP(a.profile);
        setNotes((n) => ({ ...n, face: { ok: true, lines: ["Read from your saved face photo.", ...a.notes] } }));
      } catch { /* the user can add a photo manually */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.avatar.facePhoto]);

  async function run(kind: Kind, f: File) {
    setBusy(kind);
    setNotes((n) => ({ ...n, [kind]: undefined }));
    try {
      if (kind === "face") {
        const r = await analyseFacePhoto(f);
        if (!r.ok) setNotes((n) => ({ ...n, face: { ok: false, lines: [r.reason] } }));
        else {
          const a = applyFacePhoto(latest.current, r);
          setP(a.profile);
          setNotes((n) => ({ ...n, face: { ok: true, lines: a.notes } }));
          setThumb((t) => ({ ...t, face: URL.createObjectURL(f) }));
          setFiles((x) => ({ ...x, face: f }));
        }
      } else {
        const r = await analyseBodyPhoto(f);
        if (!r.ok) setNotes((n) => ({ ...n, body: { ok: false, lines: [r.reason] } }));
        else {
          const a = applyBodyPhoto(latest.current, r);
          setP(a.profile);
          setNotes((n) => ({ ...n, body: { ok: true, lines: a.notes } }));
          setThumb((t) => ({ ...t, body: URL.createObjectURL(f) }));
          setFiles((x) => ({ ...x, body: f }));
        }
      }
    } catch (e) {
      setNotes((n) => ({ ...n, [kind]: { ok: false, lines: [e instanceof Error ? `Couldn’t run the ${kind === "face" ? "face" : "pose"} model: ${e.message}` : "Couldn’t read this photo."] } }));
    }
    setBusy(null);
  }

  /** Saves the photo on this computer so it can stand in for the cartoon figure. */
  async function keep(kind: Kind) {
    const f = files[kind];
    if (!f) return;
    setSaving(kind);
    try {
      const up = await api.upload(await downscaleJpeg(f, 1400));
      const cur = latest.current;
      setP({ ...cur, avatar: { ...cur.avatar, [kind === "body" ? "photo" : "facePhoto"]: up.image, look: cur.avatar.look === "ai" ? "ai" : "photo" } });
    } catch { /* the note below stays; nothing was saved */ }
    setSaving(null);
  }
  function drop(kind: Kind) {
    const cur = latest.current;
    const a = { ...cur.avatar, [kind === "body" ? "photo" : "facePhoto"]: null };
    if (!a.photo && !a.facePhoto && a.look === "photo") a.look = "figure";
    setP({ ...cur, avatar: a });
  }

  const savedName = (kind: Kind) => (kind === "body" ? p.avatar.photo : p.avatar.facePhoto);
  const saved = (kind: Kind) => !!(kind === "body" ? p.avatar.photo : p.avatar.facePhoto);
  const card = (kind: Kind, title: string, hint: string, has: boolean, ref: React.RefObject<HTMLInputElement | null>) => (
    <div className="card photo-card">
      <div className="photo-thumb">{thumb[kind] ? <img src={thumb[kind]} alt="" /> : savedName(kind) ? <Img name={savedName(kind)} alt="" /> : <span aria-hidden>{kind === "face" ? "☺" : "▯"}</span>}</div>
      <div className="photo-body">
        <b>{title}</b>
        <span className="xs muted">{hint}</span>
        <button className={`btn sm ${has ? "light" : "dark"}`} disabled={busy !== null} onClick={() => ref.current?.click()}>{busy === kind ? "Analysing…" : has ? "Replace photo" : "Add photo"}</button>
        {saved(kind) ? (
          <span className="xs" style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ color: "var(--good)" }}>✓ Kept on this computer</span><button className="linkish" onClick={() => drop(kind)}>Remove</button></span>
        ) : files[kind] && notes[kind]?.ok ? (
          <button className="btn dark sm" disabled={saving !== null} onClick={() => keep(kind)}>{saving === kind ? "Saving…" : "Use as my avatar"}</button>
        ) : null}
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) run(kind, f); }} />
      </div>
    </div>
  );

  return (
    <div className="my-photos">
      <div className="photo-grid">
        {kinds.includes("face") && card("face", "Face photo", "Front-facing, hair back, good light. Sets face shape, skin tone and hair colour.", !!p.face.auto, face)}
        {kinds.includes("body") && card("body", "Full-body photo", "Standing straight, feet in frame. Sets shoulders-vs-hips and torso-vs-legs.", p.body.source === "photo", body)}
      </div>
      {(["face", "body"] as Kind[]).map((k) => notes[k] && (
        <div key={k} className="card" style={{ padding: 12, marginTop: 8, fontSize: 13, lineHeight: 1.5, borderColor: notes[k]!.ok ? undefined : "#efc9c4" }}>
          {notes[k]!.lines.map((l, i) => <div key={i} style={{ color: !notes[k]!.ok ? "var(--danger)" : undefined }}>{l}</div>)}
        </div>
      ))}
      <p className="xs muted" style={{ marginTop: 8, lineHeight: 1.5 }}>Photos are read by your AI service (Gemini or OpenAI) for this one question and are not stored. They are only kept if you press “Use as my avatar” — then they stay in your Capsule data folder and “Delete everything” removes them. </p>
    </div>
  );
}
