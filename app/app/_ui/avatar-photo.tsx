"use client";
import { useEffect, useState } from "react";
import { api, imgPath } from "@/lib/api";
import { imageUrl } from "@/lib/engine";
import { toJpegDataUri } from "@/lib/image";
import { Overlay, Sheet, Img, SecretKey } from "./ui";
import { useStore } from "./store";

const CONSENT_KEY = "capsule.tryonConsent";
const TRYABLE = ["Tops", "Bottoms", "Dresses"];

/** Realistic try-on on the user's own photo, through Gemini (or FASHN). Only runs when the user presses the button. */
export function PhotoTryOn({ itemIds }: { itemIds: string[] }) {
  const { itemById, boards, pop, push, toast, refresh, profile } = useStore();
  const [st, setSt] = useState<Awaited<ReturnType<typeof api.settings>> | null>(null);
  const [consent, setConsent] = useState(false);
  const [person, setPerson] = useState<{ uri: string; preview: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saveSheet, setSaveSheet] = useState(false);
  const all = itemIds.map((i) => itemById[i]).filter(Boolean);
  const tryable = all.filter((i) => TRYABLE.includes(i.category));
  const skipped = all.filter((i) => !TRYABLE.includes(i.category));
  const [chosen, setChosen] = useState<string[]>(() => tryable.map((i) => i.id));

  // a photo you chose to keep as your avatar is used automatically
  useEffect(() => {
    const name = profile.avatar.photo;
    if (!name) return;
    let alive = true;
    (async () => {
      try {
        const blob = await (await fetch(await imageUrl(imgPath(name)))).blob();
        const uri = await toJpegDataUri(blob, 1296);
        if (alive) setPerson((cur) => cur ?? { uri, preview: URL.createObjectURL(blob) });
      } catch { /* the user can still pick a photo */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.avatar.photo]);

  useEffect(() => {
    api.settings().then(setSt).catch(() => {});
    try { setConsent(localStorage.getItem(CONSENT_KEY) === "1"); } catch { /* private mode */ }
  }, []);

  async function pickPhoto(f: File) {
    setPerson({ uri: await toJpegDataUri(f, 1296), preview: URL.createObjectURL(f) });
    setResult(null); setErr(null);
  }
  async function run() {
    if (!person) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const garments = [];
      for (const id of chosen) {
        const it = itemById[id];
        const blob = await (await fetch(await imageUrl(imgPath(it.image)))).blob();
        garments.push({ image: await toJpegDataUri(blob, 1024), category: it.category });
      }
      try { localStorage.setItem(CONSENT_KEY, "1"); } catch { /* ignore */ }
      const r = await api.tryon({ person: person.uri, garments });
      if (!r.available || !r.image) throw new Error("Photo try-on isn’t set up yet");
      setResult(r.image);
    } catch (e) { setErr(e instanceof Error ? e.message : "Try-on failed"); }
    setBusy(false);
  }
  async function saveToBoard(boardId: string) {
    if (!result) return;
    await api.addEntry(boardId, { kind: "image", image: result, note: "Try-on preview" });
    await refresh();
    setSaveSheet(false);
    toast("Saved to board");
  }

  return (
    <Overlay title="On my photo" onBack={pop}>
      <div className="sec" style={{ paddingTop: 4 }}>
        {st && !st.tryonAvailable ? (
          <div className="card" style={{ padding: 14, lineHeight: 1.5, fontSize: 13.5 }}>
            <b>Photo try-on needs a Gemini key.</b>
            <p className="muted" style={{ margin: "6px 0 10px" }}>It makes a realistic image of you wearing your pieces using Gemini image models (about 4–7 US cents per image). Add your Gemini key under Me → AI, or a FASHN key under Me → Photo try-on. Until then the avatar preview works without any account.</p>
            <button className="btn dark sm" onClick={pop}>Back to avatar</button>
          </div>
        ) : (
          <>
            <p className="sm muted" style={{ lineHeight: 1.5, marginBottom: 10 }}>Upload a clear, front-facing, full-body photo and Capsule shows you wearing {tryable.length > 1 ? "these pieces" : "this piece"}. The result is an AI-made approximation — fit, drape and fabric won’t be exact.</p>
            {skipped.length > 0 && <p className="xs muted" style={{ marginBottom: 8 }}>Not included yet: {skipped.map((i) => i.name).join(", ")} (only tops, bottoms and dresses can be tried on).</p>}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {tryable.map((i) => <button key={i.id} className={`chip ${chosen.includes(i.id) ? "on" : ""}`} onClick={() => setChosen(chosen.includes(i.id) ? chosen.filter((x) => x !== i.id) : [...chosen, i.id])}>{i.name}</button>)}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <label className="drop" style={{ flex: 1, cursor: "pointer", padding: person ? 6 : 24 }}>
                {person ? <img src={person.preview} alt="You" style={{ width: "100%", maxHeight: 230, objectFit: "contain", borderRadius: 12 }} /> : <span>Choose your photo</span>}
                <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pickPhoto(f); }} />
              </label>
              {(busy || result) && (
                <div style={{ flex: 1, background: "var(--stage)", borderRadius: 16, display: "grid", placeItems: "center", minHeight: 150, overflow: "hidden" }}>
                  {busy ? <span className="muted sm"><span className="spin" /> Making your preview…</span> : result && <Img name={result} alt="Try-on result" style={{ width: "100%", maxHeight: 230, objectFit: "contain" }} />}
                </div>
              )}
            </div>
            <label className="job" style={{ cursor: "pointer", alignItems: "flex-start", marginTop: 12 }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
              <span className="xs" style={{ lineHeight: 1.5 }}>I understand my photo and these garment images are sent to {st?.tryonProvider === "fashn" ? "FASHN (fashn.ai)" : "Google (Gemini)"} to create the preview. Capsule doesn’t keep my photo — only the result image is saved here.</span>
            </label>
            {err && <div className="sm" style={{ color: "var(--danger)", margin: "8px 0", lineHeight: 1.4 }}>{err}</div>}
            <button className="btn dark full" style={{ marginTop: 10 }} disabled={!person || !consent || busy || !chosen.length} onClick={run}>{busy ? "Working… (about 10–30 seconds)" : result ? "Try again" : "Show me wearing it"}</button>
            {result && (
              <div style={{ marginTop: 10 }}>
                <div className="xs muted" style={{ textAlign: "center", marginBottom: 8 }}>AI-generated preview — approximate</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn light sm" style={{ flex: 1 }} onClick={() => setSaveSheet(true)}>Save to a board</button>
                  <button className="btn light sm" style={{ flex: 1 }} onClick={() => push({ t: "avatar" })}>Edit avatar</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {saveSheet && (
        <Sheet onClose={() => setSaveSheet(false)}>
          <h2 className="h-l" style={{ marginBottom: 10 }}>Save to board</h2>
          {boards.length === 0 && <p className="sm muted">Create a board in Closet → Boards first.</p>}
          {boards.map((b) => <button key={b.id} className="opt" onClick={() => saveToBoard(b.id)}><span><b>{b.name}</b><span className="xs muted">{b.count} saved</span></span></button>)}
        </Sheet>
      )}
    </Overlay>
  );
}

export function TryOnSettings() {
  const { toast } = useStore();
  const [st, setSt] = useState<Awaited<ReturnType<typeof api.settings>> | null>(null);
  useEffect(() => { api.settings().then(setSt).catch(() => {}); }, []);
  if (!st) return null;
  async function pick(p: "gemini" | "fashn") { await api.saveSettings({ tryonProvider: p }); setSt(await api.settings()); }
  const label = st.tryonProvider === "gemini" ? "Gemini" : st.tryonProvider === "fashn" ? "FASHN" : "";
  return (
    <div className="sec">
      <h3>Photo try-on</h3>
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <b style={{ fontSize: 15 }}>See yourself wearing it</b>
          <span className={`pill ${st.tryonAvailable ? "ai" : "guess"}`}>{st.tryonAvailable ? `Using ${label}` : "Not connected"}</span>
        </div>
        <p className="xs muted" style={{ lineHeight: 1.5, marginBottom: 10 }}>
          {st.tryonHasGemini
            ? <>Works with your Gemini key — no extra account. Uses <code>{st.tryonModel}</code> (about {st.tryonModel.includes("3.1") ? "7" : "4"} US cents per image; “Better” quality under Me → AI uses the stronger model). </>
            : <>Add a Gemini key under Me → AI and this works with it, or use a <a href="https://fashn.ai" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>FASHN</a> key below. </>}
          Your photo is sent only when you press the button and isn’t stored here. Results are AI-made approximations and carry an invisible Google watermark.
        </p>
        {st.tryonHasGemini && st.tryonHasFashn && (
          <div className="chips" style={{ padding: 0, margin: "0 0 10px" }}>
            {(["gemini", "fashn"] as const).map((p) => <button key={p} className={`chip ${st.tryonProvider === p ? "on" : ""}`} onClick={() => pick(p)}>{p === "gemini" ? "Gemini" : "FASHN (purpose-built)"}</button>)}
          </div>
        )}
        {st.tryonKeyFromEnv ? <div className="xs muted">FASHN key is set via the FASHN_API_KEY environment variable.</div> : (
          <SecretKey
            isSet={st.tryonHasFashn}
            placeholder="Optional: FASHN API key"
            noun="FASHN key"
            onSave={async (v) => { await api.saveSettings({ fashnKey: v }); setSt(await api.settings()); toast("Try-on key saved on this computer"); }}
            onRemove={async () => { await api.saveSettings({ fashnKey: "" }); setSt(await api.settings()); toast("Try-on key removed"); }}
          />
        )}
      </div>
    </div>
  );
}
