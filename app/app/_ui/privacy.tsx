"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BROWSER_ENGINE, engineStatus } from "@/lib/engine";
import { AiKeyField } from "./gemini-key";
import { open as openBox, seal } from "@/lib/backup";
import { Overlay, Sheet, SecretKey } from "./ui";
import { useStore } from "./store";

type Inv = Awaited<ReturnType<typeof api.inventory>>;
const mb = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

const LEAVES: { who: string; what: string; when: string; on?: (i: Inv) => boolean; key?: "gemini" | "openai" | "serpapi" }[] = [
  { who: "Google Gemini", what: "When Gemini is your AI service: the photos you add (shrunk first), your face and body photos when you press analyse, your try-on and avatar photos, and a short text summary of your profile, closet and habits (the AI brain). Never your whole library.", when: "Only while a Gemini key is saved and you use an AI feature.", on: (i) => i.keys.gemini, key: "gemini" },
  { who: "OpenAI", what: "The same, if OpenAI is your AI service instead.", when: "Only while an OpenAI key is saved and you use an AI feature.", on: (i) => i.keys.openai, key: "openai" },
  { who: "SerpApi", what: "Search words only (for example “olive overshirt men”). Never photos.", when: "Only while a shopping key is set.", on: (i) => i.keys.serpapi, key: "serpapi" },
  { who: "Open-Meteo", what: "The coordinates of the place you chose, to fetch a forecast.", when: "Only if you turn weather on." },
  { who: "Stores you open", what: "Links open in a new tab, like any link. Capsule adds no tracking or affiliate tags.", when: "When you tap a link." },
];

export function PrivacyCentre() {
  const { pop, refresh, toast } = useStore();
  const [inv, setInv] = useState<Inv | null>(null);
  const [pinSheet, setPinSheet] = useState(false);
  const [bkSheet, setBkSheet] = useState<null | "make" | "restore">(null);
  const [wipeSheet, setWipeSheet] = useState(false);
  const load = () => api.inventory().then(setInv).catch(() => {});
  useEffect(() => { load(); }, []);
  const total = inv ? Object.values(inv.rows).reduce((a, n) => a + n, 0) : 0;

  async function forgetPermissions() {
    try { localStorage.removeItem("capsule.tryonConsent"); localStorage.removeItem("capsule.location"); } catch { /* ignore */ }
    toast("Saved permissions cleared — Capsule will ask again");
  }

  return (
    <Overlay title="Privacy & data" onBack={pop}>
      <div className="sec" style={{ paddingTop: 4 }}>
        <p className="sm" style={{ lineHeight: 1.55 }}>Capsule keeps your closet, photos and profile <b>on your computer</b>. Nothing is uploaded unless you turn on a service below, and each one is optional.</p>
      </div>

      <div className="sec">
        <h3>What’s stored here</h3>
        {!inv ? <div className="muted sm">Counting…</div> : (
          <div className="card" style={{ padding: 14, fontSize: 14, lineHeight: 1.9 }}>
            {[["Pieces", inv.rows.items], ["Outfits", inv.rows.outfits], ["Days logged", inv.rows.wears], ["Boards", inv.rows.boards], ["Shopping looks", inv.rows.looks], ["Saved products", inv.rows.products], ["Capsules & trips", inv.rows.capsules]].map(([l, n]) => (
              <div key={l as string} style={{ display: "flex", justifyContent: "space-between" }}><span>{l}</span><b>{n}</b></div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Photos on disk</span><b>{inv.photos.files} · {mb(inv.photos.bytes)}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Style profile</span><b>{inv.profile ? "Saved" : "—"}</b></div>
            <div className="xs muted" style={{ lineHeight: 1.5, marginTop: 6 }}>Face, body and colour photos you analyse are processed in your browser and are <b>not</b> saved — only the results (for example a season or a proportion).</div>
          </div>
        )}
      </div>

      <div className="sec">
        <h3>What can leave this device</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {LEAVES.map((l) => {
            const on = l.on ? (inv ? l.on(inv) : false) : undefined;
            return (
              <div key={l.who} className="card" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b style={{ fontSize: 14 }}>{l.who}</b>{on !== undefined && <span className={`pill ${on ? "guess" : "ai"}`}>{on ? "Key saved" : "No key"}</span>}</div>
                <div className="sm" style={{ lineHeight: 1.45, marginTop: 2 }}>{l.what}</div>
                <div className="xs muted" style={{ marginTop: 2 }}>{l.when}</div>
                {(l.key === "gemini" || l.key === "openai") && <div style={{ marginTop: 10 }}><AiKeyField which={l.key} onChange={() => load()} /></div>}
                {l.key === "serpapi" && <div style={{ marginTop: 10 }}><SecretKey isSet={!!inv?.keys.serpapi} placeholder="Paste your SerpApi key" noun="shopping key" onSave={async (v) => { await api.saveSettings({ serpApiKey: v }); await load(); }} onRemove={async () => { await api.saveSettings({ serpApiKey: "" }); await load(); }} /></div>}
              </div>
            );
          })}
        </div>
        <button className="chip" style={{ marginTop: 10 }} onClick={forgetPermissions}>Forget saved permissions</button>
      </div>

      {BROWSER_ENGINE ? (
        <div className="sec">
          <h3>Where your library lives</h3>
          <div className="card" style={{ padding: 14 }}>
            <p className="sm" style={{ lineHeight: 1.5 }}>Everything is stored inside this browser on this device — there is no Capsule account or server copy. Clearing site data or uninstalling the app erases it, and it does not sync to your other devices. Make an encrypted backup below to keep it safe or move it.</p>
            {!engineStatus.persistent && <p className="sm" style={{ color: "var(--danger)", marginTop: 8 }}>This window can’t keep data after it closes (private browsing?). Export a backup before leaving.</p>}
          </div>
        </div>
      ) : (
      <div className="sec">
        <h3>Lock</h3>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b style={{ fontSize: 15 }}>PIN</b><span className={`pill ${inv?.pin ? "ai" : "guess"}`}>{inv?.pin ? "On" : "Off"}</span>
          </div>
          <p className="xs muted" style={{ lineHeight: 1.5, margin: "6px 0 10px" }}>A PIN keeps others out if they use this computer — and is required before Capsule can be opened from your phone (<code>npm run lan</code>). Without it the app only answers on this computer.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn dark sm" onClick={() => setPinSheet(true)}>{inv?.pin ? "Change or remove" : "Set a PIN"}</button>
            {inv?.pin && <button className="btn light sm" onClick={async () => { await api.logout(); window.location.href = "/unlock"; }}>Lock now</button>}
          </div>
        </div>
      </div>
      )}

      <div className="sec">
        <h3>Backup</h3>
        <div className="card" style={{ padding: 14 }}>
          <p className="xs muted" style={{ lineHeight: 1.5, marginBottom: 10 }}>An encrypted backup is a single file only your passphrase can open — safe to keep in cloud storage or email to yourself. Lose the passphrase and it can’t be recovered.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn dark sm" style={{ flex: 1 }} onClick={() => setBkSheet("make")}>Create encrypted backup</button>
            <button className="btn light sm" style={{ flex: 1 }} onClick={() => setBkSheet("restore")}>Restore</button>
          </div>
        </div>
      </div>

      <div className="sec" style={{ paddingBottom: 24 }}>
        <h3>Delete</h3>
        <div className="card" style={{ padding: 14, borderColor: "#efc9c4" }}>
          <p className="xs muted" style={{ lineHeight: 1.5, marginBottom: 10 }}>Removes every piece, outfit, board, look, plan and photo ({total} records, {inv ? inv.photos.files : 0} photos). Make a backup first if you might want it back.</p>
          <button className="btn danger full" onClick={() => setWipeSheet(true)}>Delete everything…</button>
        </div>
      </div>

      {pinSheet && <PinSheet hasPin={!!inv?.pin} onClose={() => setPinSheet(false)} onDone={() => { setPinSheet(false); load(); }} />}
      {bkSheet && <BackupSheet mode={bkSheet} onClose={() => setBkSheet(null)} onDone={async () => { setBkSheet(null); await refresh(); load(); }} />}
      {wipeSheet && <WipeSheet onClose={() => setWipeSheet(false)} />}
    </Overlay>
  );
}

function PinSheet({ hasPin, onClose, onDone }: { hasPin: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useStore();
  const [cur, setCur] = useState(""), [pin, setPin] = useState(""), [pin2, setPin2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 12);
  async function save(remove: boolean) {
    setErr(null);
    if (!remove && pin !== pin2) return setErr("The two PINs don’t match");
    try { await api.setPin({ current: cur, pin: remove ? null : pin }); toast(remove ? "PIN removed" : "PIN saved"); onDone(); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t save"); }
  }
  return (
    <Sheet onClose={onClose}>
      <h2 className="h-l" style={{ marginBottom: 10 }}>{hasPin ? "Change or remove PIN" : "Set a PIN"}</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {hasPin && <input className="input" type="password" inputMode="numeric" placeholder="Current PIN" autoComplete="current-password" value={cur} onChange={(e) => setCur(digits(e.target.value))} />}
        <input className="input" type="password" inputMode="numeric" placeholder="New PIN (4–12 digits)" autoComplete="new-password" value={pin} onChange={(e) => setPin(digits(e.target.value))} />
        <input className="input" type="password" inputMode="numeric" placeholder="Repeat new PIN" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(digits(e.target.value))} />
        {err && <div role="alert" className="sm" style={{ color: "var(--danger)" }}>{err}</div>}
        <button className="btn dark full" disabled={pin.length < 4} onClick={() => save(false)}>Save PIN</button>
        {hasPin && <button className="btn danger full" disabled={cur.length < 4} onClick={() => save(true)}>Remove PIN</button>}
        <p className="xs muted" style={{ lineHeight: 1.5 }}>Changing or removing the PIN signs out other devices.</p>
      </div>
    </Sheet>
  );
}

function BackupSheet({ mode, onClose, onDone }: { mode: "make" | "restore"; onClose: () => void; onDone: () => void }) {
  const { toast } = useStore();
  const [pass, setPass] = useState(""), [pass2, setPass2] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function make() {
    setErr(null);
    if (pass !== pass2) return setErr("The passphrases don’t match");
    setBusy(true);
    try {
      const box = await seal(JSON.stringify(await api.exportAll()), pass);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(box)], { type: "application/json" }));
      a.download = `capsule-backup-${new Date().toISOString().slice(0, 10)}.capsulebak`;
      a.click();
      toast("Backup downloaded");
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t make the backup"); }
    setBusy(false);
  }
  async function restore() {
    if (!file) return;
    setErr(null);
    if (!confirm("Restoring replaces your whole current library with the backup. Continue?")) return;
    setBusy(true);
    try {
      const plain = await openBox(JSON.parse(await file.text()), pass);
      const r = await api.importData(JSON.parse(plain));
      toast(`Restored ${r.items} pieces, ${r.outfits} outfits, ${r.boards} boards`);
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t restore"); }
    setBusy(false);
  }
  return (
    <Sheet onClose={() => !busy && onClose()}>
      <h2 className="h-l" style={{ marginBottom: 10 }}>{mode === "make" ? "Create encrypted backup" : "Restore a backup"}</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {mode === "restore" && (
          <label className="drop" style={{ display: "block", cursor: "pointer", padding: 16 }}>{file ? file.name : "Choose a .capsulebak file"}<input type="file" accept=".capsulebak,application/json" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        )}
        <input className="input" type="password" placeholder="Passphrase (8+ characters)" autoComplete={mode === "make" ? "new-password" : "current-password"} value={pass} onChange={(e) => setPass(e.target.value)} />
        {mode === "make" && <input className="input" type="password" placeholder="Repeat passphrase" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} />}
        {err && <div role="alert" className="sm" style={{ color: "var(--danger)" }}>{err}</div>}
        {mode === "make" ? <button className="btn dark full" disabled={busy || pass.length < 8} onClick={make}>{busy ? "Encrypting…" : "Download backup"}</button> : <button className="btn dark full" disabled={busy || !file || pass.length < 8} onClick={restore}>{busy ? "Restoring…" : "Restore"}</button>}
        <p className="xs muted" style={{ lineHeight: 1.5 }}>Encrypted here in your browser with AES-256; the passphrase never leaves this device.</p>
      </div>
    </Sheet>
  );
}

function WipeSheet({ onClose }: { onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const [keys, setKeys] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function wipe() {
    setBusy(true); setErr(null);
    try {
      await api.wipe({ confirm: typed, keys });
      try { localStorage.clear(); } catch { /* ignore */ }
      if ("caches" in window) for (const k of await caches.keys()) await caches.delete(k);
      window.location.href = "/";
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t delete"); setBusy(false); }
  }
  return (
    <Sheet onClose={() => !busy && onClose()}>
      <h2 className="h-l" style={{ marginBottom: 6 }}>Delete everything?</h2>
      <p className="sm" style={{ lineHeight: 1.5, marginBottom: 10 }}>This permanently removes your pieces, outfits, boards, looks, plans, profile and every stored photo. It can’t be undone.</p>
      <label className="job" style={{ cursor: "pointer" }}><input type="checkbox" checked={keys} onChange={(e) => setKeys(e.target.checked)} /><span>Also remove my API keys (Anthropic, SerpApi, FASHN)</span></label>
      <input className="input" style={{ margin: "10px 0" }} placeholder="Type DELETE EVERYTHING" aria-label="Type DELETE EVERYTHING to confirm" value={typed} onChange={(e) => setTyped(e.target.value)} />
      {err && <div role="alert" className="sm" style={{ color: "var(--danger)", marginBottom: 8 }}>{err}</div>}
      <button className="btn danger full" disabled={busy || typed !== "DELETE EVERYTHING"} onClick={wipe}>{busy ? "Deleting…" : "Delete everything"}</button>
    </Sheet>
  );
}

export function PrivacyCard() {
  const { push } = useStore();
  return (
    <div className="sec">
      <h3>Privacy &amp; data</h3>
      <button className="card" onClick={() => push({ t: "privacy" })} style={{ width: "100%", padding: 14, textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span><b style={{ fontSize: 15 }}>Your data stays with you</b><br /><span className="xs muted">What’s stored, what can leave, PIN lock, encrypted backup, delete everything</span></span><span>›</span>
      </button>
    </div>
  );
}
