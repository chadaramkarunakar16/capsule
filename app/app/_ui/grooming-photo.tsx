"use client";
import { useEffect, useState } from "react";
import { api, imgPath, type Settings } from "@/lib/api";
import { FRAMES } from "@/lib/grooming/catalog";
import { frameColours } from "@/lib/grooming/suggest";
import { imageUrl } from "@/lib/engine";
import { toJpegDataUri } from "@/lib/image";
import { Img, Overlay, Sheet } from "./ui";
import { useStore } from "./store";

/** Frames shown on the person's own photo by the AI service they chose. One picture per press (about 4–5 cents); the photo is not stored. */
export function GlassesPhoto({ frame: initial }: { frame?: string }) {
  const { profile, boards, pop, toast, refresh } = useStore();
  const colours = frameColours(profile.color.season).colours;
  const [frame, setFrame] = useState(initial ?? "oval");
  const [col, setCol] = useState(colours[0]);
  const [photo, setPhoto] = useState<{ uri: string; preview: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [boardSheet, setBoardSheet] = useState(false);
  const [st, setSt] = useState<Settings | null>(null);
  useEffect(() => { api.settings().then(setSt).catch(() => {}); }, []);

  async function pick(f: File) {
    setErr(null); setResult(null);
    setPhoto({ uri: await toJpegDataUri(f, 1024), preview: URL.createObjectURL(f) });
  }
  async function run() {
    if (!photo) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.glasses({ photo: photo.uri, frame, colour: col.name });
      if (!r.available || !r.image) throw new Error("Add an AI key in Me → AI first.");
      setResult(r.image);
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t add the glasses"); }
    setBusy(false);
  }
  async function download() {
    if (!result) return;
    const b = await (await fetch(await imageUrl(imgPath(result)))).blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = `glasses-${frame}.jpg`; a.click();
  }
  async function toBoard(id: string) {
    if (!result) return;
    await api.addEntry(id, { kind: "image", image: result, note: `${FRAMES.find((f) => f.id === frame)?.name} frames` });
    await refresh();
    setBoardSheet(false);
    toast("Saved to board");
  }
  const who = st?.aiProviderName ?? "your AI service";

  return (
    <Overlay title="Frames on my photo" onBack={pop}>
      <div className="sec" style={{ paddingTop: 4 }}>
        <p className="sm muted" style={{ lineHeight: 1.5, marginBottom: 10 }}>Use a clear, front-facing photo of your face. {who} puts the frames you pick on it. It takes about 20 seconds and costs a few cents per picture.</p>
        <div className="chips" style={{ padding: 0, marginBottom: 8 }}>{FRAMES.map((f) => <button key={f.id} className={`chip ${frame === f.id ? "on" : ""}`} onClick={() => setFrame(f.id)}>{f.name}</button>)}</div>
        <div style={{ display: "flex", gap: 10, margin: "10px 0", flexWrap: "wrap" }}>
          {colours.map((c) => <button key={c.name} aria-label={c.name} title={c.name} onClick={() => setCol(c)} className="sw" style={{ width: 32, height: 32, background: c.hex, boxShadow: col.name === c.name ? "0 0 0 2.5px var(--ink)" : "inset 0 0 0 1px rgba(0,0,0,.15)" }} />)}
        </div>

        <div style={{ display: "grid", gap: 10, justifyItems: "center", margin: "12px 0" }}>
          {result ? <Img name={result} alt="Photo with frames" style={{ width: "100%", maxWidth: 420, borderRadius: 16, background: "var(--stage)" }} />
            : photo ? <img src={photo.preview} alt="Your photo" style={{ width: "100%", maxWidth: 420, borderRadius: 16, background: "var(--stage)" }} /> : null}
          {result && <div className="xs muted" style={{ textAlign: "center" }}>AI-made preview — real frames vary in size and fit.</div>}
        </div>

        <label className="drop" style={{ display: "block", cursor: "pointer" }}>
          <span className="btn light sm" style={{ pointerEvents: "none" }}>{photo ? "Choose a different photo" : "Choose a photo"}</span>
          <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pick(f); }} />
        </label>

        {photo && (
          <>
            <label className="job" style={{ cursor: "pointer", alignItems: "flex-start", marginTop: 12 }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
              <span className="xs" style={{ lineHeight: 1.5 }}>I understand my photo is sent to {who} to make this picture. Capsule doesn’t keep my photo — only the result is saved here.</span>
            </label>
            <button className="btn dark full" style={{ marginTop: 10 }} disabled={!consent || busy} onClick={run}>{busy ? "Working… (about 20 seconds)" : result ? "Try these frames again" : "Show me in these frames"}</button>
          </>
        )}
        {err && <div className="sm" style={{ color: "var(--danger)", marginTop: 10, lineHeight: 1.4 }}>{err}</div>}
        {result && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn light sm" style={{ flex: 1 }} onClick={download}>Save image</button>
            <button className="btn light sm" style={{ flex: 1 }} onClick={() => setBoardSheet(true)}>Save to board</button>
          </div>
        )}
      </div>
      {boardSheet && (
        <Sheet onClose={() => setBoardSheet(false)}>
          <h2 className="h-l" style={{ marginBottom: 10 }}>Save to board</h2>
          {boards.length === 0 && <p className="sm muted">Create a board in Closet → Boards first.</p>}
          {boards.map((b) => <button key={b.id} className="opt" onClick={() => toBoard(b.id)}><span><b>{b.name}</b><span className="xs muted">{b.count} saved</span></span></button>)}
        </Sheet>
      )}
    </Overlay>
  );
}
