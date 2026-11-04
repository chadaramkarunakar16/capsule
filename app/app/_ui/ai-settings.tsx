"use client";
import { useEffect, useState } from "react";
import { api, type BrainState, type Settings } from "@/lib/api";
import { AiKeyField } from "./gemini-key";
import { useStore } from "./store";

/** Me → AI: the provider keys, which service is used, quality, and the model each kind of job runs on. */
export function AiCard() {
  const { toast } = useStore();
  const [st, setSt] = useState<Settings | null>(null);
  useEffect(() => { api.settings().then(setSt).catch(() => {}); }, []);
  const reload = async () => setSt(await api.settings());
  if (!st) return null;
  const p = st.aiProvider;
  const r = p ? st.aiRoutes[p][st.aiQuality] : null;
  const both = st.hasGemini && st.hasOpenai;
  const set = async (b: Parameters<typeof api.saveSettings>[0]) => { await api.saveSettings(b); await reload(); };
  const u = st.aiUsage;
  return (
    <div className="sec">
      <h3>AI</h3>
      <div className="card" style={{ padding: 14, display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <b style={{ fontSize: 15 }}>{st.aiAvailable ? "Connected" : "Not connected"}</b>
          <span className={`pill ${st.aiAvailable ? "ai" : "guess"}`}>{st.aiProviderName ? `Using ${st.aiProviderName}` : "Add a key"}</span>
        </div>
        <p className="xs muted" style={{ lineHeight: 1.5, margin: 0 }}>
          Every AI feature runs on the key you add — reading your photos and pieces, the stylist, try-on, glasses, your avatar picture and the AI brain. Nothing is installed or run on this computer. Keys are stored only here and never shown.
        </p>

        <div style={{ display: "grid", gap: 6 }}>
          <label className="f" style={{ margin: 0 }}>Google Gemini key</label>
          <AiKeyField which="gemini" onChange={reload} />
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <label className="f" style={{ margin: 0 }}>OpenAI key</label>
          <AiKeyField which="openai" onChange={reload} />
          <span className="xs muted">Don’t have Gemini? An OpenAI key works the same way. Image features may need your OpenAI organisation to be verified.</span>
        </div>

        {both && (
          <div>
            <b style={{ fontSize: 13 }}>Use</b>
            <div className="chips" style={{ padding: 0, margin: "6px 0 0" }}>
              {(["gemini", "openai"] as const).map((x) => <button key={x} className={`chip ${p === x ? "on" : ""}`} onClick={() => set({ aiProvider: x })}>{x === "gemini" ? "Gemini" : "OpenAI"}</button>)}
            </div>
          </div>
        )}

        <div>
          <b style={{ fontSize: 13 }}>Quality</b>
          <div className="chips" style={{ padding: 0, margin: "6px 0" }}>
            {(["economy", "better"] as const).map((q) => <button key={q} className={`chip ${st.aiQuality === q ? "on" : ""}`} onClick={() => set({ aiQuality: q })}>{q === "economy" ? "Economy (default)" : "Better"}</button>)}
          </div>
          {r && (
            <p className="xs muted" style={{ lineHeight: 1.7, margin: 0 }}>
              Each kind of job uses the smallest model that does it well:<br />
              Reading photos and notes — <code>{r.read}</code><br />
              Outfit photos, looks, stylist advice — <code>{r.think}</code><br />
              Try-on, glasses, clean cut-outs — <code>{r.edit}</code><br />
              The picture of you (must look like you) — <code>{r.likeness}</code><br />
              “Better” upgrades reasoning and picture editing to the next model: a bit more per use, about 2–3× on text.
            </p>
          )}
          {u.calls > 0 && <p className="xs muted" style={{ marginTop: 6 }}>This month: {u.calls} AI calls, about {Math.round((u.inTok + u.outTok) / 1000)}k tokens.</p>}
        </div>
        {!st.aiAvailable && <button className="btn light sm" style={{ justifySelf: "start" }} onClick={() => toast("Paste a key above and press Save")}>How do I get a key?</button>}
      </div>
    </div>
  );
}

/** Me → AI brain: what the shared memory has learned, with switches to pause, refresh or erase it. */
export function BrainCard() {
  const { toast } = useStore();
  const [b, setB] = useState<BrainState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.brain().then(setB).catch(() => {}); }, []);
  if (!b) return null;
  const act = async (x: Parameters<typeof api.brainAct>[0], done?: string) => {
    setBusy(true);
    try { setB(await api.brainAct(x)); if (done) toast(done); } catch (e) { toast(e instanceof Error ? e.message : "Couldn’t do that"); }
    setBusy(false);
  };
  const m = b.memory;
  return (
    <div className="sec">
      <h3>AI brain</h3>
      <div className="card" style={{ padding: 14, display: "grid", gap: 12 }}>
        <p className="xs muted" style={{ lineHeight: 1.5, margin: 0 }}>
          One shared memory for every AI feature. It notices what you confirm, correct, like, wear, save and ask for, keeps short notes about your taste, and gives them to the AI each time — so tagging, looks, the stylist and outfit advice all get better together. Only short text notes are shared with the AI, never your photos.
        </p>
        <label className="job" style={{ cursor: "pointer", padding: 0 }}>
          <input type="checkbox" checked={b.enabled} disabled={busy} onChange={(e) => act({ action: "toggle", enabled: e.target.checked }, e.target.checked ? "The brain is learning again" : "The brain stopped learning")} />
          <span>Learn from how I use Capsule</span>
        </label>
        {b.enabled && (
          <>
            <div className="sm" style={{ lineHeight: 1.5 }}>
              {b.events === 0 ? "Nothing noticed yet — it starts as you add pieces, confirm tags, like outfits and ask the stylist." : <>Noticed <b>{b.events}</b> thing{b.events === 1 ? "" : "s"}{b.since ? ` since ${String(b.since).slice(0, 10)}` : ""}{b.newSince > 0 ? ` · ${b.newSince} new since the notes were updated` : ""}.</>}
            </div>
            {m ? (
              <div style={{ display: "grid", gap: 8 }}>
                {m.summary && <p className="sm" style={{ lineHeight: 1.55, margin: 0 }}>{m.summary}</p>}
                {m.likes.length > 0 && <div className="chips" style={{ padding: 0, flexWrap: "wrap" }}>{m.likes.map((x) => <span key={x} className="pill ai">♥ {x}</span>)}</div>}
                {m.dislikes.length > 0 && <div className="chips" style={{ padding: 0, flexWrap: "wrap" }}>{m.dislikes.map((x) => <span key={x} className="pill dup">✕ {x}</span>)}</div>}
                {m.rules.length > 0 && <ul className="xs" style={{ paddingLeft: 18, lineHeight: 1.6, margin: 0 }}>{m.rules.map((x) => <li key={x}>{x}</li>)}</ul>}
                <span className="xs muted">Notes updated {String(m.updatedAt).slice(0, 16).replace("T", " ")}</span>
              </div>
            ) : b.events > 0 && <span className="xs muted">The brain writes its notes after a few more actions{b.aiReady ? "" : " (needs an AI key)"}.</span>}
            {b.corrections.length > 0 && <div className="xs muted" style={{ lineHeight: 1.5 }}>You corrected the AI: {b.corrections.slice(0, 3).join(" · ")}</div>}
          </>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn light sm" disabled={busy || !b.enabled || !b.aiReady || b.events === 0} onClick={() => act({ action: "reflect" }, "Notes updated")}>{busy ? "Working…" : "Update notes now"}</button>
          <button className="btn danger sm" disabled={busy || (b.events === 0 && !m)} onClick={() => { if (confirm("Erase everything the brain has learned about you? Your closet and profile stay.")) act({ action: "forget" }, "The brain forgot what it learned"); }}>Forget what it learned</button>
        </div>
      </div>
    </div>
  );
}
