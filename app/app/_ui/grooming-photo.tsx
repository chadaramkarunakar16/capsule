"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { FRAMES } from "@/lib/grooming/catalog";
import { framePaths, glassesPlacement } from "@/lib/grooming/draw";
import { frameColours } from "@/lib/grooming/suggest";
import { detectFaceLandmarks } from "@/lib/vision";
import { Overlay, Sheet } from "./ui";
import { useStore } from "./store";

type Loaded = { canvas: HTMLCanvasElement; place: NonNullable<ReturnType<typeof glassesPlacement>> };

/** Frames drawn on the user's own photo using face landmarks. Everything happens in the browser; the photo is never uploaded. */
export function GlassesPhoto({ frame: initial }: { frame?: string }) {
  const { profile, boards, pop, toast, refresh } = useStore();
  const colours = frameColours(profile.color.season).colours;
  const [frame, setFrame] = useState(initial ?? "oval");
  const [col, setCol] = useState(colours[0]);
  const [size, setSize] = useState(1);
  const [nudge, setNudge] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [boardSheet, setBoardSheet] = useState(false);
  const view = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const out = view.current;
    if (!out || !loaded) return;
    const { canvas, place } = loaded;
    out.width = canvas.width; out.height = canvas.height;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(canvas, 0, 0);
    const w = place.width * size;
    const g = framePaths(frame, 0, 0, w);
    ctx.save();
    ctx.translate(place.cx, place.cy + nudge * place.width * 0.1);
    ctx.rotate(place.angle);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (g.brow) { ctx.fillStyle = col.hex; ctx.fill(new Path2D(g.brow)); }
    ctx.lineWidth = g.thickness * 1.6;
    ctx.strokeStyle = col.hex;
    for (const d of g.lenses) { const p = new Path2D(d); ctx.fillStyle = "rgba(255,255,255,.10)"; ctx.fill(p); ctx.stroke(p); }
    ctx.stroke(new Path2D(g.bridge));
    for (const d of g.arms) ctx.stroke(new Path2D(d));
    ctx.restore();
  }, [loaded, frame, col, size, nudge]);

  async function pick(f: File) {
    setBusy(true); setErr(null); setLoaded(null);
    try {
      const r = await detectFaceLandmarks(f);
      if (!r.ok) { setErr(r.reason); setBusy(false); return; }
      const place = glassesPlacement(r.landmarks);
      if (!place) { setErr("Couldn't place frames on this photo. Try a straighter, closer shot."); setBusy(false); return; }
      setLoaded({ canvas: r.canvas, place });
    } catch (e) { setErr(e instanceof Error ? `Couldn't run the face model: ${e.message}` : "Couldn't run the face model."); }
    setBusy(false);
  }
  const toBlob = () => new Promise<Blob | null>((res) => view.current?.toBlob(res, "image/jpeg", 0.92));
  async function download() {
    const b = await toBlob();
    if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = `glasses-${frame}.jpg`; a.click();
  }
  async function toBoard(id: string) {
    const b = await toBlob();
    if (!b) return;
    const up = await api.upload(b);
    await api.addEntry(id, { kind: "image", image: up.image, note: `${FRAMES.find((f) => f.id === frame)?.name} frames` });
    await refresh();
    setBoardSheet(false);
    toast("Saved to board");
  }

  return (
    <Overlay title="Frames on my photo" onBack={pop}>
      <div className="sec" style={{ paddingTop: 4 }}>
        {!loaded ? (
          <>
            <p className="sm muted" style={{ lineHeight: 1.5, marginBottom: 10 }}>Use a clear, front-facing photo with your whole face in the frame and glasses off. The photo is processed on this device and never uploaded.</p>
            <label className="drop" style={{ display: "block", cursor: "pointer" }}>
              <span className="btn dark" style={{ pointerEvents: "none" }}>{busy ? "Finding your face…" : "Choose a photo"}</span>
              <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pick(f); }} />
              <div className="xs" style={{ marginTop: 8 }}>The first run downloads a small face model</div>
            </label>
            {err && <div className="sm" style={{ color: "var(--danger)", marginTop: 10, lineHeight: 1.4 }}>{err}</div>}
          </>
        ) : (
          <>
            <canvas ref={view} style={{ width: "100%", borderRadius: 16, background: "var(--stage)", display: "block" }} aria-label="Photo with frames" />
            <div className="xs muted" style={{ textAlign: "center", margin: "6px 0 10px" }}>Approximate preview — real frames vary in size and fit.</div>
            <div className="chips" style={{ padding: 0, marginBottom: 8 }}>{FRAMES.map((f) => <button key={f.id} className={`chip ${frame === f.id ? "on" : ""}`} onClick={() => setFrame(f.id)}>{f.name}</button>)}</div>
            <div style={{ display: "flex", gap: 10, margin: "10px 0", flexWrap: "wrap" }}>
              {colours.map((c) => <button key={c.name} aria-label={c.name} onClick={() => setCol(c)} className="sw" style={{ width: 32, height: 32, background: c.hex, boxShadow: col.name === c.name ? "0 0 0 2.5px var(--ink)" : "inset 0 0 0 1px rgba(0,0,0,.15)" }} />)}
            </div>
            <label className="f">Size</label>
            <input type="range" min={0.8} max={1.2} step={0.02} value={size} onChange={(e) => setSize(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--ink)" }} />
            <label className="f" style={{ marginTop: 8 }}>Up / down</label>
            <input type="range" min={-1} max={1} step={0.05} value={nudge} onChange={(e) => setNudge(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--ink)" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn light sm" style={{ flex: 1 }} onClick={download}>Save image</button>
              <button className="btn light sm" style={{ flex: 1 }} onClick={() => setBoardSheet(true)}>Save to board</button>
              <button className="btn light sm" style={{ flex: 1 }} onClick={() => setLoaded(null)}>New photo</button>
            </div>
          </>
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
