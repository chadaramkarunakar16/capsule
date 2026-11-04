"use client";
import { useState } from "react";

export default function Unlock() {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
    if (r.ok) { window.location.href = "/"; return; }
    setErr((await r.json().catch(() => ({}))).error ?? "Couldn’t unlock");
    setBusy(false);
  }
  return (
    <main className="app" style={{ justifyContent: "center", padding: 28 }}>
      <form onSubmit={go} style={{ display: "grid", gap: 14, textAlign: "center" }}>
        <h1 className="title">Capsule</h1>
        <p className="sm muted">Enter your PIN to open your closet.</p>
        <input className="input" style={{ textAlign: "center", fontSize: 22, letterSpacing: 8 }} type="password" inputMode="numeric" autoComplete="current-password" autoFocus aria-label="PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))} />
        {err && <div role="alert" className="sm" style={{ color: "var(--danger)" }}>{err}</div>}
        <button className="btn dark full" disabled={busy || pin.length < 4}>{busy ? "Checking…" : "Unlock"}</button>
      </form>
    </main>
  );
}
