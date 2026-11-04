"use client";
import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { imgPath } from "@/lib/api";
import { imageUrl, BROWSER_ENGINE } from "@/lib/engine";
import { CAT_ORDER, type Item } from "@/lib/types";

export const I = {
  back: <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>,
  close: <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  plus: <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>,
  search: <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>,
  today: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></svg>,
  closet: <svg viewBox="0 0 24 24"><path d="M12 6a2 2 0 10-2-2M12 6v2L3.5 14a1.5 1.5 0 001 2.7h15a1.5 1.5 0 001-2.7L12 8" /></svg>,
  capsule: <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M4 12h16" /></svg>,
  me: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6" /></svg>,
  photo: <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="9" cy="11" r="2" /><path d="M21 16l-5-4-7 7" /></svg>,
  board: <svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="10" rx="2" /><rect x="13" y="3" width="8" height="6" rx="2" /><rect x="13" y="11" width="8" height="10" rx="2" /><rect x="3" y="15" width="8" height="6" rx="2" /></svg>,
  chev: <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>,
  flame: <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: "currentColor", stroke: "none" }}><path d="M12 2c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-9z" /></svg>,
};

export function Ico({ children, onClick, label }: { children: ReactNode; onClick?: () => void; label: string }) {
  return (
    <button className="ico" onClick={onClick} aria-label={label}>
      {children}
    </button>
  );
}

const byCat = (a: Item, b: Item) => (CAT_ORDER[a.category] ?? 9) - (CAT_ORDER[b.category] ?? 9);

/** URL for an uploaded picture; in the hosted build it is an object URL resolved from the local engine. */
export function useImageUrl(name: string | null | undefined, w?: number) {
  const path = name ? imgPath(name, w) : "";
  const [src, setSrc] = useState(BROWSER_ENGINE ? "" : path);
  useEffect(() => {
    if (!BROWSER_ENGINE) { setSrc(path); return; }
    let alive = true;
    if (path) imageUrl(path).then((u) => alive && setSrc(u)).catch(() => {});
    else setSrc("");
    return () => { alive = false; };
  }, [path]);
  return BROWSER_ENGINE ? src : path;
}

type ImgProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & { name: string | null | undefined; w?: number };
export function Img({ name, w, alt = "", ...rest }: ImgProps) {
  const src = useImageUrl(name, w);
  const [bad, setBad] = useState<string | null>(null);
  if (!src) return <span {...(rest as object)} aria-hidden style={{ display: "block", ...rest.style }} />;
  if (bad === src) {
    // the file is gone (for example after "Delete everything"), so say so instead of showing a broken-image icon
    return <span title="This photo is no longer on this computer" style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", minHeight: 40, color: "var(--muted)", fontSize: 11, textAlign: "center", ...rest.style, objectFit: undefined, filter: "none" }}>No photo</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} onError={() => setBad(src)} {...rest} />;
}

export function Chips<T extends string>({ options, value, onPick, labels }: { options: readonly T[]; value: T | null | ""; onPick: (v: T | null) => void; labels?: Record<string, string> }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => (
        <button key={o} className={`chip ${value === o ? "on" : ""}`} onClick={() => onPick(value === o ? null : o)}>{labels?.[o] ?? o.charAt(0).toUpperCase() + o.slice(1)}</button>
      ))}
    </div>
  );
}


/**
 * An API key field that never shows the key, not even part of it. Once a key is saved the field is closed
 * (just "saved"), with Replace and Remove; Replace opens an empty box, and saving closes it again.
 */
export function SecretKey({ isSet, placeholder, onSave, onRemove, noun = "key" }: { isSet: boolean; placeholder: string; onSave: (value: string) => Promise<void>; onRemove: () => Promise<void>; noun?: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const open = !isSet || editing;
  async function save() {
    if (!value.trim()) return;
    setBusy(true);
    try { await onSave(value.trim()); setValue(""); setEditing(false); } finally { setBusy(false); }
  }
  async function remove() {
    if (!confirm(`Remove the saved ${noun} from this computer?`)) return;
    setBusy(true);
    try { await onRemove(); setValue(""); setEditing(false); } finally { setBusy(false); }
  }
  if (!open) {
    return (
      <div className="secret-row">
        <span className="secret-mask" aria-label={`A ${noun} is saved`}>{"•".repeat(16)}<span className="xs muted"> saved · hidden</span></span>
        <button className="btn light sm" disabled={busy} onClick={() => setEditing(true)}>Edit key</button>
        <button className="btn danger sm" disabled={busy} onClick={remove}>Remove</button>
      </div>
    );
  }
  return (
    <form className="secret-row" onSubmit={(e) => { e.preventDefault(); save(); }} autoComplete="off">
      <input className="input" type="password" name="capsule-secret" placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} autoComplete="new-password" spellCheck={false} autoFocus={editing} />
      <button className="btn dark sm" type="submit" disabled={busy || !value.trim()}>Save</button>
      {editing && <button className="btn light sm" type="button" disabled={busy} onClick={() => { setEditing(false); setValue(""); }}>Cancel</button>}
    </form>
  );
}

/** 2x2 preview of an outfit's pieces. */
export function Collage({ items, big }: { items: Item[]; big?: boolean }) {
  const s = [...items].sort(byCat).slice(0, 4);
  if (!s.length) return <div className="collage" />;
  return (
    <div className={`collage ${big ? "big" : ""} ${s.length === 1 ? "one" : ""}`}>
      {s.map((i) => (
        <div key={i.id}>
          <Img name={i.image} w={big ? 320 : 160} alt={i.name} />
        </div>
      ))}
    </div>
  );
}

export function Tile({ item, onClick, selected, badge }: { item: Item; onClick?: () => void; selected?: boolean; badge?: string }) {
  return (
    <button className={`tile ${selected ? "sel" : ""}`} onClick={onClick}>
      <div className="img">
        <Img name={item.image} w={320} alt={item.name} loading="lazy" />
        <span className="dot" style={{ background: item.colorHex }} />
        {badge && <span className="badge">{badge}</span>}
        {selected && <span className="check">✓</span>}
      </div>
      <div className="b">{item.brand || item.category}</div>
      <div className="t">{item.name || "Untitled"}</div>
    </button>
  );
}

/** Esc closes the topmost overlay or sheet only. */
const escStack: Array<() => void> = [];
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && escStack.length) { e.preventDefault(); escStack[escStack.length - 1](); }
  });
}
function useEsc(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const h = () => ref.current();
    escStack.push(h);
    return () => { const i = escStack.lastIndexOf(h); if (i >= 0) escStack.splice(i, 1); };
  }, []);
}

export function Overlay({ title, onBack, children, foot, right }: { title: string; onBack: () => void; children: ReactNode; foot?: ReactNode; right?: ReactNode }) {
  useEsc(onBack);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="ov-hdr">
        <Ico onClick={onBack} label="Back">{I.back}</Ico>
        <div className="grow">{title}</div>
        {right}
      </div>
      <div className="ov-body">{children}</div>
      {foot && <div className="ov-foot">{foot}</div>}
    </div>
  );
}

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEsc(onClose);
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grab" />
        {children}
      </div>
    </div>
  );
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const today = () => iso(new Date());
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fmtDate = (s: string) => new Date(s + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
export const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
