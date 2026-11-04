"use client";
import { useEffect, useRef, useState } from "react";
import { api, img } from "@/lib/api";
import { downscaleJpeg } from "@/lib/image";
import type { Board, BoardEntry } from "@/lib/types";
import { Collage, Ico, I, Overlay, Sheet, Img } from "./ui";
import { PickItems } from "./pick";
import { useStartLook } from "./shop";
import { useStore } from "./store";

/** Pick a board (or create one) and save an item/outfit to it. */
export function AddToBoard({ kind, refId, onClose }: { kind: "item" | "outfit"; refId: string; onClose: () => void }) {
  const { boards, refresh, toast } = useStore();
  const [name, setName] = useState("");

  async function add(boardId: string, label: string) {
    const r = await api.addEntry(boardId, { kind, refId });
    await refresh();
    toast(r.duplicate ? `Already on “${label}”` : `Saved to “${label}”`);
    onClose();
  }
  async function create() {
    if (!name.trim()) return;
    const b = await api.createBoard(name.trim());
    await add(b.id, b.name);
  }
  return (
    <Sheet onClose={onClose}>
      <h2 className="h-l" style={{ marginBottom: 12 }}>Save to board</h2>
      {boards.map((b) => (
        <button key={b.id} className="opt" onClick={() => add(b.id, b.name)}>
          <span className="ic">{I.board}</span>
          <span><b>{b.name}</b><span className="xs muted">{b.count} saved</span></span>
        </button>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <input className="input" placeholder="New board name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
        <button className="btn dark" disabled={!name.trim()} onClick={create}>Create</button>
      </div>
    </Sheet>
  );
}

export function NewBoardSheet({ onClose }: { onClose: () => void }) {
  const { refresh, push } = useStore();
  const [name, setName] = useState("");
  async function create() {
    if (!name.trim()) return;
    const b = await api.createBoard(name.trim());
    await refresh();
    onClose();
    push({ t: "board", id: b.id });
  }
  return (
    <Sheet onClose={onClose}>
      <h2 className="h-l" style={{ marginBottom: 12 }}>New board</h2>
      <input autoFocus className="input" placeholder="e.g. Soft autumn workwear" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
      <button className="btn dark full" style={{ marginTop: 12 }} disabled={!name.trim()} onClick={create}>Create board</button>
    </Sheet>
  );
}

export function BoardView({ id }: { id: string }) {
  const { pop, push, itemById, outfits, refresh, toast } = useStore();
  const [board, setBoard] = useState<Board | null>(null);
  const [add, setAdd] = useState<null | "menu" | "closet" | "outfits" | "image">(null);
  const [pick, setPick] = useState<string[]>([]);
  const [editing, setEditing] = useState<BoardEntry | null>(null);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const { start: startLook, busy: lookBusy } = useStartLook();
  const [draft, setDraft] = useState<{ blob: Blob; preview: string } | null>(null);
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");

  const load = () => api.board(id).then((b) => { setBoard(b); setName(b.name); }).catch(() => pop());
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function addMany(kind: "item" | "outfit", ids: string[]) {
    for (const r of ids) await api.addEntry(id, { kind, refId: r });
    await Promise.all([load(), refresh()]);
    setAdd(null);
    setPick([]);
    toast(`Added ${ids.length}`);
  }
  async function onFile(f: File) {
    const blob = await downscaleJpeg(f, 1400);
    setDraft({ blob, preview: URL.createObjectURL(blob) });
    setAdd("image");
  }
  async function saveImage() {
    if (!draft) return;
    const up = await api.upload(draft.blob);
    await api.addEntry(id, { kind: "image", image: up.image, note, url });
    setDraft(null); setNote(""); setUrl(""); setAdd(null);
    await Promise.all([load(), refresh()]);
    toast("Saved to board");
  }
  async function removeEntry(e: BoardEntry) {
    await api.deleteEntry(id, e.id);
    await Promise.all([load(), refresh()]);
  }
  async function rename() {
    if (name.trim() && board && name.trim() !== board.name) { await api.renameBoard(id, name.trim()); await Promise.all([load(), refresh()]); }
    setRenaming(false);
  }
  async function delBoard() {
    if (!confirm("Delete this board? Items and outfits stay in your closet.")) return;
    await api.deleteBoard(id);
    await refresh();
    pop();
  }
  async function saveEntry() {
    if (!editing) return;
    await api.updateEntry(id, editing.id, { note: editing.note, url: editing.url });
    setEditing(null);
    load();
  }

  return (
    <Overlay
      title={board?.name ?? "Board"}
      onBack={pop}
      right={<>
        <Ico label="Add" onClick={() => setAdd("menu")}>{I.plus}</Ico>
        <button className="chip" onClick={() => setRenaming(true)}>Rename</button>
      </>}
    >
      {board && board.entries.length === 0 && (
        <div className="empty">
          <h3>Start collecting</h3>
          Save looks you love, pieces from your closet, or inspiration images from Instagram and Pinterest.
          <div style={{ marginTop: 18 }}><button className="btn dark" onClick={() => setAdd("menu")}>Add to board</button></div>
        </div>
      )}
      <div className="masonry">
        {board?.entries.map((e) => {
          if (e.kind === "image")
            return (
              <div key={e.id} className="pin">
                <button style={{ display: "block", width: "100%", background: "none", border: 0, padding: 0 }} onClick={() => setEditing(e)}>
                  <Img className="cover" name={e.image} alt={e.note || "Inspiration"} />
                </button>
                {(e.note || e.url) && <div className="cap">{e.note}{e.url && <div className="xs muted" style={{ wordBreak: "break-all" }}>{e.url}</div>}</div>}
                <span className="tag">Inspiration</span>
                <button className="rm" aria-label="Remove" onClick={() => removeEntry(e)}>✕</button>
              </div>
            );
          if (e.kind === "item") {
            const it = e.refId ? itemById[e.refId] : null;
            if (!it) return null;
            return (
              <div key={e.id} className="pin">
                <button style={{ display: "block", width: "100%", background: "none", border: 0, padding: 0 }} onClick={() => push({ t: "item", id: it.id })}>
                  <Img className="contain" name={it.image} alt={it.name} />
                </button>
                <div className="cap"><b>{it.brand || it.category}</b> {it.name}</div>
                <span className="tag">Closet</span>
                <button className="rm" aria-label="Remove" onClick={() => removeEntry(e)}>✕</button>
              </div>
            );
          }
          const o = outfits.find((x) => x.id === e.refId);
          if (!o) return null;
          return (
            <div key={e.id} className="pin">
              <button style={{ display: "block", width: "100%", background: "none", border: 0, padding: 0 }} onClick={() => push({ t: "outfit", outfitId: o.id })}>
                <Collage big items={o.itemIds.map((i) => itemById[i]).filter(Boolean)} />
              </button>
              <div className="cap"><b>{o.name}</b></div>
              <span className="tag">Outfit</span>
              <button className="rm" aria-label="Remove" onClick={() => removeEntry(e)}>✕</button>
            </div>
          );
        })}
      </div>

      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />

      {add === "menu" && (
        <Sheet onClose={() => setAdd(null)}>
          <h2 className="h-l" style={{ marginBottom: 12 }}>Add to board</h2>
          <button className="opt" onClick={() => file.current?.click()}><span className="ic">{I.photo}</span><span><b>Inspiration image</b><span className="xs muted">Screenshot from Instagram, Pinterest…</span></span></button>
          <button className="opt" onClick={() => setAdd("closet")}><span className="ic">{I.closet}</span><span><b>From my closet</b><span className="xs muted">Pick pieces you own</span></span></button>
          <button className="opt" onClick={() => setAdd("outfits")}><span className="ic">{I.capsule}</span><span><b>My outfits</b><span className="xs muted">Saved looks</span></span></button>
        </Sheet>
      )}
      {add === "image" && draft && (
        <Sheet onClose={() => { setDraft(null); setAdd(null); }}>
          <h2 className="h-l" style={{ marginBottom: 12 }}>Save inspiration</h2>
          <img src={draft.preview} alt="" style={{ width: "100%", maxHeight: 260, objectFit: "contain", borderRadius: 16, background: "var(--stage)" }} />
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <input className="input" placeholder="Source link (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn dark full" onClick={saveImage}>Save to board</button>
          </div>
        </Sheet>
      )}
      {add === "closet" && (
        <div className="overlay" style={{ zIndex: 50 }}>
          <div className="ov-hdr"><Ico label="Back" onClick={() => { setAdd(null); setPick([]); }}>{I.back}</Ico><div className="grow">Pick pieces</div></div>
          <div className="ov-body"><PickItems selected={pick} onToggle={(i) => setPick((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))} /></div>
          <div className="ov-foot"><button className="btn dark full" disabled={!pick.length} onClick={() => addMany("item", pick)}>Add {pick.length || ""} to board</button></div>
        </div>
      )}
      {add === "outfits" && (
        <div className="overlay" style={{ zIndex: 50 }}>
          <div className="ov-hdr"><Ico label="Back" onClick={() => { setAdd(null); setPick([]); }}>{I.back}</Ico><div className="grow">Pick outfits</div></div>
          <div className="ov-body">
            {outfits.length === 0 && <div className="empty sm">No saved outfits yet.</div>}
            <div className="grid2">
              {outfits.map((o) => (
                <button key={o.id} className="ocard" style={pick.includes(o.id) ? { boxShadow: "0 0 0 2.5px var(--ink)" } : undefined} onClick={() => setPick((p) => (p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id]))}>
                  <Collage items={o.itemIds.map((i) => itemById[i]).filter(Boolean)} />
                  <div className="n">{o.name}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="ov-foot"><button className="btn dark full" disabled={!pick.length} onClick={() => addMany("outfit", pick)}>Add {pick.length || ""} to board</button></div>
        </div>
      )}
      {renaming && (
        <Sheet onClose={() => setRenaming(false)}>
          <h2 className="h-l" style={{ marginBottom: 12 }}>Board name</h2>
          <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && rename()} />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn dark" style={{ flex: 1 }} onClick={rename}>Save</button>
            <button className="btn danger" onClick={delBoard}>Delete board</button>
          </div>
        </Sheet>
      )}
      {editing && (
        <Sheet onClose={() => setEditing(null)}>
          <h2 className="h-l" style={{ marginBottom: 12 }}>Inspiration details</h2>
          <Img name={editing.image} alt="" style={{ width: "100%", maxHeight: 240, objectFit: "contain", borderRadius: 16, background: "var(--stage)" }} />
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <input className="input" placeholder="Note" value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
            <input className="input" placeholder="Source link" value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} />
            <button className="btn dark full" onClick={saveEntry}>Save</button>
            <button className="btn light full" disabled={lookBusy} onClick={() => editing.image && startLook(null, editing.image, editing.url)}>{lookBusy ? "Opening…" : "Find these pieces →"}</button>
          </div>
        </Sheet>
      )}
    </Overlay>
  );
}

