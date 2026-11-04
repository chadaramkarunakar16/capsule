"use client";
import { useRef, useState } from "react";
import { api, img } from "@/lib/api";
import { CATEGORIES, type Item } from "@/lib/types";
import { colorDistance, downscaleJpeg, guessTags, nameColor, removeBg, trimPng } from "@/lib/image";
import { Sheet, Img } from "./ui";
import { useStore } from "./store";

type Job = { id: number; name: string; preview: string; status: string; state: "run" | "done" | "error"; error?: string };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The "+" sheet: bulk photo upload → cut-out → tag → drafts for review. */
export function AddSheet() {
  const { setSheet, refresh, push, toast } = useStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [cut, setCut] = useState(true);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const outfitInput = useRef<HTMLInputElement>(null);

  const patch = (id: number, p: Partial<Job>) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...p } : j)));

  async function processFiles(files: File[]) {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return toast("Please choose image files");
    setBusy(true);
    const base = Date.now();
    const list: Job[] = imgs.map((f, k) => ({ id: base + k, name: f.name, preview: URL.createObjectURL(f), status: "Waiting…", state: "run" }));
    setJobs((js) => [...list, ...js]);
    let ok = 0;
    for (let k = 0; k < imgs.length; k++) {
      const f = imgs[k], id = list[k].id;
      try {
        patch(id, { status: "Preparing photo…" });
        const original = await downscaleJpeg(f);
        let cutout: Blob = original, w = 0, h = 0;
        if (cut) {
          patch(id, { status: "Removing background…" });
          try {
            let last = -1;
            const png = await removeBg(original, (p, what) => {
              const pct = Math.round(p * 100);
              if (pct !== last) { last = pct; patch(id, { status: what.startsWith("fetch") ? `Loading cut-out model… ${pct}%` : "Removing background…" }); }
            });
            const t = await trimPng(png);
            cutout = t.blob; w = t.w; h = t.h;
          } catch (e) {
            console.warn("background removal failed, using original", e);
            patch(id, { status: "Cut-out unavailable — using the original photo…" });
            await wait(600);
          }
        }
        if (!w) {
          const bm = await createImageBitmap(cutout);
          w = bm.width; h = bm.height;
        }
        patch(id, { status: "Saving…" });
        const up = await api.upload(cutout, original);
        patch(id, { status: "Tagging…" });
        let tags = null as Awaited<ReturnType<typeof api.tag>>["tags"] | null;
        try {
          const r = await api.tag(up.image);
          if (r.aiAvailable && r.tags) tags = r.tags;
        } catch (e) {
          console.warn("AI tagging failed, using local guess", e);
        }
        const aiTagged = !!tags;
        if (!tags) tags = await guessTags(cutout, w, h);
        await api.createItem({
          image: up.image,
          original: up.original,
          status: "draft",
          aiTagged,
          ...tags,
          colorHex: tags.colorHex ?? "#cccccc",
          colorName: tags.colorName || nameColor(tags.colorHex ?? "#cccccc"),
        });
        patch(id, { status: "Ready to review", state: "done" });
        ok++;
      } catch (e) {
        patch(id, { status: e instanceof Error ? e.message : "Failed", state: "error" });
      }
    }
    await refresh();
    setBusy(false);
    if (ok) toast(`${ok} item${ok > 1 ? "s" : ""} ready to review`);
  }

  /** A photo of someone wearing an outfit → each piece cropped, cut out and saved as a draft. Needs the AI key. */
  async function processOutfit(f: File) {
    if (!f.type.startsWith("image/")) return toast("Please choose an image");
    setBusy(true);
    const id = Date.now();
    setJobs((js) => [{ id, name: f.name, preview: URL.createObjectURL(f), status: "Preparing photo…", state: "run" }, ...js]);
    try {
      const original = await downscaleJpeg(f, 1600);
      patch(id, { status: "Uploading…" });
      const up = await api.upload(original);
      patch(id, { status: "Finding the pieces you’re wearing…" });
      const r = await api.split(up.image);
      if (!r.aiAvailable) throw new Error("Splitting an outfit photo needs a Gemini key — add one in Me → AI (Gemini).");
      const pieces = r.pieces ?? [];
      if (!pieces.length) throw new Error("No separate pieces were found in this photo.");
      const bm = await createImageBitmap(original);
      const ids: string[] = [];
      for (let k = 0; k < pieces.length; k++) {
        const p = pieces[k];
        patch(id, { status: `Piece ${k + 1} of ${pieces.length}: ${p.name || p.category}…` });
        const mx = (p.box[2] - p.box[0]) * 0.04, my = (p.box[3] - p.box[1]) * 0.04;
        const x0 = Math.max(0, ((p.box[0] - mx) / 1000) * bm.width), y0 = Math.max(0, ((p.box[1] - my) / 1000) * bm.height);
        const x1 = Math.min(bm.width, ((p.box[2] + mx) / 1000) * bm.width), y1 = Math.min(bm.height, ((p.box[3] + my) / 1000) * bm.height);
        const c = document.createElement("canvas");
        c.width = Math.max(8, Math.round(x1 - x0)); c.height = Math.max(8, Math.round(y1 - y0));
        c.getContext("2d")!.drawImage(bm, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
        const crop = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("crop failed"))), "image/jpeg", 0.9));
        let cutout: Blob = crop;
        if (cut) { try { cutout = (await trimPng(await removeBg(crop))).blob; } catch (e) { console.warn("cut-out failed for a piece", e); } }
        const saved = await api.upload(cutout);
        let tags: Awaited<ReturnType<typeof api.tag>>["tags"] | null = null;
        try { const t = await api.tag(saved.image); if (t.aiAvailable && t.tags) tags = t.tags; } catch { /* keep the split's own labels */ }
        const hex = tags?.colorHex ?? (await guessTags(cutout, c.width, c.height)).colorHex ?? "#cccccc";
        const item = await api.createItem({
          image: saved.image, status: "draft", aiTagged: true, ...tags,
          name: tags?.name || p.name, category: p.category, colorHex: hex, colorName: tags?.colorName || nameColor(hex),
        });
        ids.push(item.id);
      }
      await api.createOutfit({ name: "From photo", itemIds: ids });
      await refresh();
      patch(id, { status: `${ids.length} pieces ready to review`, state: "done" });
      toast("Pieces added as drafts — review them next");
    } catch (e) {
      patch(id, { status: e instanceof Error ? e.message : "Failed", state: "error" });
    }
    setBusy(false);
  }

  const done = jobs.filter((j) => j.state !== "run").length;
  const allDone = jobs.length > 0 && !busy;

  return (
    <Sheet onClose={() => !busy && setSheet(null)}>
      <h2 className="h-l" style={{ marginBottom: 14 }}>Add to your closet</h2>
      <div
        className={`drop ${over ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) processFiles([...e.dataTransfer.files]); }}
      >
        <div style={{ marginBottom: 10 }}>Drop photos here — hanger, flat-lay or floor shots, one item per photo</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn dark" disabled={busy} onClick={() => input.current?.click()}>Choose photos</button>
          <button className="btn light" disabled={busy} onClick={() => outfitInput.current?.click()}>Outfit photo</button>
        </div>
        <div className="xs" style={{ marginTop: 8 }}>“Outfit photo” splits a mirror selfie into its pieces (needs an AI key)</div>
        <input ref={outfitInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) processOutfit(f); }} />
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; processFiles(fs); }} />
      </div>
      <label className="job" style={{ cursor: "pointer", marginTop: 6 }}>
        <input type="checkbox" checked={cut} onChange={(e) => setCut(e.target.checked)} disabled={busy} />
        <span>Remove backgrounds on this device <span className="muted xs">(slower, cleaner closet)</span></span>
      </label>
      {jobs.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="prog"><i style={{ width: `${(done / jobs.length) * 100}%` }} /></div>
          <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 6 }}>
            {jobs.map((j) => (
              <div className="job" key={j.id}>
                <div className="th"><img src={j.preview} alt="" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.name}</div>
                  <div className="xs muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.status}</div>
                </div>
                {j.state === "run" ? <span className="spin" /> : j.state === "done" ? <span style={{ color: "var(--good)" }}>✓</span> : <span style={{ color: "var(--danger)" }}>!</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {!busy && (
        <button className="opt" style={{ marginTop: 12, marginBottom: 0 }} onClick={() => setSheet("shop")}>
          <span className="ic"><svg viewBox="0 0 24 24"><path d="M6 8h12l-1 12H7zM9 8a3 3 0 016 0" /></svg></span>
          <span><b>Shop a look</b><span className="xs muted">Found an outfit on Instagram or Pinterest? Find the pieces</span></span>
        </button>
      )}
      {allDone && (
        <button className="btn dark full" style={{ marginTop: 12 }} onClick={() => { setSheet(null); push({ t: "review" }); }}>
          Review &amp; confirm
        </button>
      )}
    </Sheet>
  );
}

/** Review queue for drafts: fix tags, flag duplicates, confirm. */
export function ReviewQueue() {
  const { drafts, items, refresh, toast } = useStore();
  const [edits, setEdits] = useState<Record<string, Partial<Item>>>({});
  const set = (id: string, p: Partial<Item>) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...p } }));

  const dupOf = (d: Item) => items.find((i) => i.category === d.category && colorDistance(i.colorHex, d.colorHex) < 28);

  async function confirm(d: Item) {
    await api.updateItem(d.id, { ...edits[d.id], status: "active" });
    await refresh();
  }
  async function remove(d: Item) {
    await api.deleteItem(d.id);
    await refresh();
  }
  async function confirmAll() {
    for (const d of drafts) await api.updateItem(d.id, { ...edits[d.id], status: "active" });
    await refresh();
    toast(`${drafts.length} items added to your closet`);
  }

  return (
    <>
      <div style={{ padding: "4px 20px 12px" }} className="sm muted">
        Check the details — fixing a wrong tag takes one tap. Items are saved as drafts until you confirm.
      </div>
      {drafts.length === 0 && (
        <div className="empty"><h3>All caught up</h3>Nothing to review.</div>
      )}
      {drafts.map((d) => {
        const e = { ...d, ...edits[d.id] };
        const dup = dupOf(d);
        return (
          <div className="rq" key={d.id}>
            <div className="img"><Img name={d.image} alt="" /></div>
            <div className="mid">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className={`pill ${d.aiTagged ? "ai" : "guess"}`}>{d.aiTagged ? "AI-tagged" : "Guessed — please check"}</span>
                {dup && <span className="pill dup">Similar to “{dup.name || dup.category}”</span>}
              </div>
              <input className="input" value={e.name} placeholder="Name" onChange={(ev) => set(d.id, { name: ev.target.value })} />
              <div style={{ display: "flex", gap: 6 }}>
                <select className="input" value={e.category} onChange={(ev) => set(d.id, { category: ev.target.value })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <input className="input" value={e.colorName} placeholder="Colour" onChange={(ev) => set(d.id, { colorName: ev.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn dark sm" style={{ flex: 1 }} onClick={() => confirm(d)}>✓ Confirm</button>
                <button className="btn danger sm" onClick={() => remove(d)}>Delete</button>
              </div>
            </div>
          </div>
        );
      })}
      {drafts.length > 1 && (
        <div style={{ padding: "6px 20px" }}>
          <button className="btn light full" onClick={confirmAll}>Confirm all {drafts.length}</button>
        </div>
      )}
    </>
  );
}

