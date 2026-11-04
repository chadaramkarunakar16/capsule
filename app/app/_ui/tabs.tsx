"use client";
import { useMemo, useRef, useState } from "react";
import { api, img } from "@/lib/api";
import { CATEGORIES } from "@/lib/types";
import { Collage, I, Ico, Tile, fmtDate, iso, money, today, Img, SecretKey } from "./ui";
import { NewBoardSheet } from "./boards";
import { SetupBanner, StyleHub } from "./style";
import { ClosetReview, Rediscover, StyleMeCard } from "./stylist";
import { ShopSection, ShoppingSettings, ToBuyCard, useWanted } from "./shop";
import { InsightsPlus, PlansSection } from "./capsule";
import { AvatarCard } from "./avatar";
import { GroomingCard } from "./grooming";
import { PrivacyCard } from "./privacy";
import { AiCard, BrainCard } from "./ai-settings";
import { itemFit } from "@/lib/style/score";
import { useStore } from "./store";
import { StylistCard } from "./advice";

/* ============================== TODAY ============================== */
export function TodayTab() {
  const { wears, itemById, push, loaded, items, refresh, toast, capsules } = useStore();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const t = today();
  const byDate = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const w of wears) if (!w.planned) (m[w.date] ??= []).push(...w.itemIds);
    for (const k of Object.keys(m)) m[k] = [...new Set(m[k])];
    return m;
  }, [wears]);
  const itemsOf = (d: string) => (byDate[d] ?? []).map((i) => itemById[i]).filter(Boolean);
  const plannedOf = (d: string) => wears.filter((w) => w.planned && w.date === d).flatMap((w) => w.itemIds).map((i) => itemById[i]).filter(Boolean);
  const plannedToday = wears.find((w) => w.planned && w.date === t);
  const trip = capsules.find((c) => c.kind === "trip" && c.days.some((d) => d.date === t));
  const tripDay = trip?.days.find((d) => d.date === t);

  const streak = useMemo(() => {
    let n = 0;
    const d = new Date();
    if (!byDate[iso(d)]) d.setDate(d.getDate() - 1); // today not logged yet doesn't break the streak
    while (byDate[iso(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }, [byDate]);

  const hr = new Date().getHours();
  const greet = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  const week = Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + k); return d; });
  const first = month.getDay();
  const dim = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const todayItems = itemsOf(t);

  return (
    <>
      <div className="hdr">
        <span className="logo">Capsule</span>
        {streak > 0 && <span className="streak">{I.flame} {streak}-day streak</span>}
      </div>
      <div className="scroll">
        <div style={{ padding: "4px 20px 0" }}>
          <h1 className="h-l" style={{ fontSize: 26 }}>{greet}</h1>
          <div className="muted sm">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
        <SetupBanner />
        <div className="weekstrip" style={{ marginTop: 10 }}>
          {week.map((d) => {
            const k = iso(d);
            return (
              <button key={k} className={`day ${k === t ? "today" : ""}`} onClick={() => push({ t: "log", date: k })}>
                <span>{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                <div className="sil">{itemsOf(k).length ? <Collage items={itemsOf(k)} /> : <span style={{ fontSize: 18, color: "#cfc9be" }}>+</span>}</div>
                <span>{d.getDate()}</span>
              </button>
            );
          })}
        </div>

        {trip && tripDay && !todayItems.length && !plannedToday && (
          <div className="card" style={{ margin: "14px 20px 0", padding: 14, background: "#eef3ff", borderColor: "#d6e0fb" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div className="xs muted" style={{ fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" }}>{trip.name} · day {trip.days.findIndex((d) => d.date === t) + 1} of {trip.days.length}</div>
                <h2 className="h-l" style={{ fontSize: 18 }}>Today’s trip look</h2>
              </div>
              <button className="btn dark sm" onClick={async () => { await api.logWear({ date: t, itemIds: tripDay.itemIds }); await refresh(); toast("Logged as worn"); }}>I wore this</button>
            </div>
            <Collage big items={tripDay.itemIds.map((i) => itemById[i]).filter(Boolean)} />
            <button className="chip" style={{ marginTop: 4 }} onClick={() => push({ t: "capsule", id: trip.id })}>Open trip ›</button>
          </div>
        )}
        <StyleMeCard />
        {plannedToday && !todayItems.length && (
          <div className="card" style={{ margin: "14px 20px 0", padding: 14, background: "#fff8ea", borderColor: "#f1deb2" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 className="h-l" style={{ fontSize: 18 }}>Planned for today</h2>
              <button className="btn dark sm" onClick={async () => { await api.patchWear(plannedToday.id, { planned: false }); await refresh(); toast("Logged as worn"); }}>I wore this</button>
            </div>
            <Collage big items={plannedOf(t)} />
          </div>
        )}
        <div className="card" style={{ margin: "14px 20px 0", padding: 14, background: "var(--stage)", border: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className="h-l" style={{ fontSize: 20 }}>Worn today</h2>
            <button className="chip" onClick={() => push({ t: "log", date: t })}>{todayItems.length ? "Edit" : "Log outfit"}</button>
          </div>
          {todayItems.length ? <Collage big items={todayItems} /> : (
            <div className="empty" style={{ padding: "26px 10px 12px" }}>
              {loaded && items.length === 0 ? <>Add a few pieces first — tap <b>+</b> below.<br />Capsule will then suggest outfits from what you own.</> : <>Nothing logged yet.<br />Tell Capsule what you’re wearing to start tracking cost-per-wear.</>}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 20px 8px" }}>
          <h2 className="h-l" style={{ fontSize: 20 }}>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
          <div className="row">
            <Ico label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>{I.back}</Ico>
            <Ico label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>{I.chev}</Ico>
          </div>
        </div>
        <div className="cal">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="dh">{d}</div>)}
          {Array.from({ length: first }, (_, i) => <div key={"e" + i} className="cell empty" />)}
          {Array.from({ length: dim }, (_, i) => {
            const k = iso(new Date(month.getFullYear(), month.getMonth(), i + 1));
            const its = itemsOf(k);
            return (
              <button key={k} className={`cell ${k === t ? "today" : ""} ${!its.length && plannedOf(k).length ? "planned" : ""}`} onClick={() => push({ t: "log", date: k })} aria-label={fmtDate(k)}>
                <span className="n">{i + 1}</span>
                {its.length > 0 ? <Collage items={its} /> : plannedOf(k).length > 0 ? <Collage items={plannedOf(k)} /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ============================== CLOSET ============================== */
const SORTS = [
  ["new", "Newest"], ["most", "Most worn"], ["least", "Least worn"], ["price", "Price: high to low"], ["name", "Name"], ["fit", "Suits you"],
] as const;

export function ClosetTab() {
  const { items, drafts, outfits, boards, itemById, push, setSheet, loaded, profile, looks, refresh, toast } = useStore();
  const toBuy = useWanted().filter((w) => !w.own);
  const [view, setView] = useState<"items" | "outfits" | "boards" | "shop">("items");
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number][0]>("new");
  const [newBoard, setNewBoard] = useState(false);
  const [sel, setSel] = useState<Set<string> | null>(null); // null = not selecting
  const [deleting, setDeleting] = useState(false);
  const flip = (id: string) => setSel((cur) => { const n = new Set(cur ?? []); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  async function deleteSelected() {
    if (!sel || !sel.size) return;
    const what = view === "outfits" ? "outfit" : "piece";
    if (!confirm(`Delete ${sel.size} ${what}${sel.size === 1 ? "" : "s"}? ${view === "outfits" ? "The pieces stay in your closet." : "They will also be removed from outfits and boards."}`)) return;
    setDeleting(true);
    try { for (const id of sel) await (view === "outfits" ? api.deleteOutfit(id) : api.deleteItem(id)); await refresh(); toast(`Deleted ${sel.size}`); setSel(null); } catch (e) { toast(e instanceof Error ? e.message : "Couldn\u2019t delete"); }
    setDeleting(false);
  }

  const list = useMemo(() => {
    const l = items.filter((i) => (cat === "All" || i.category === cat) && (!q || `${i.name} ${i.brand} ${i.colorName} ${i.category}`.toLowerCase().includes(q.toLowerCase())));
    const s = [...l];
    if (sort === "most") s.sort((a, b) => b.wears - a.wears);
    if (sort === "least") s.sort((a, b) => a.wears - b.wears);
    if (sort === "price") s.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    if (sort === "name") s.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "fit") s.sort((a, b) => itemFit(b, profile).score - itemFit(a, profile).score);
    return s;
  }, [items, cat, q, sort, profile]);

  return (
    <>
      <div className="hdr">
        <h1 className="title">Closet</h1>
        <Ico label="Add" onClick={() => setSheet("add")}>{I.plus}</Ico>
      </div>
      <div className="seg">
        {(["items", "outfits", "boards", "shop"] as const).map((v) => (
          <button key={v} className={view === v ? "on" : ""} onClick={() => { setSel(null); setView(v); }}>{v === "shop" ? "Inspo & buy" : v[0].toUpperCase() + v.slice(1)}</button>
        ))}
      </div>
      <div className="scroll">
        {view === "items" && (
          <>
            {(looks.length > 0 || toBuy.length > 0) && (
              <button className="card" style={{ margin: "12px 20px 0", padding: "12px 16px", width: "calc(100% - 40px)", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", background: "#f4efff", borderColor: "#e3d9fb" }} onClick={() => setView("shop")}>
                <span><b>Inspiration &amp; to buy</b><br /><span className="xs muted">{looks.length} look{looks.length === 1 ? "" : "s"} you’re into · {toBuy.length} piece{toBuy.length === 1 ? "" : "s"} to buy</span></span>
                <span>{I.chev}</span>
              </button>
            )}
            {drafts.length > 0 && (
              <button className="card" style={{ margin: "12px 20px 0", padding: "12px 16px", width: "calc(100% - 40px)", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", background: "#fff8ea", borderColor: "#f1deb2" }} onClick={() => push({ t: "review" })}>
                <span><b>{drafts.length} item{drafts.length > 1 ? "s" : ""} to review</b><br /><span className="xs muted">Confirm tags to add them to your closet</span></span>
                <span>{I.chev}</span>
              </button>
            )}
            <SetupBanner />
            <div className="search">
              {I.search}
              <input className="input" placeholder={`Search ${items.length} items`} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="chips">
              {["All", ...CATEGORIES].map((c) => <button key={c} className={`chip ${c === cat ? "on" : ""}`} onClick={() => setCat(c)}>{c}</button>)}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 20px 0" }}>
              <span className="xs muted">{sel ? `${sel.size} selected` : `${list.length} item${list.length === 1 ? "" : "s"}`}</span>
              <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {items.length > 0 && !sel && <button className="chip" style={{ height: 28 }} onClick={() => push({ t: "tryon", itemIds: [] })}>Try on me</button>}
                {items.length > 0 && <button className="chip" style={{ height: 28 }} onClick={() => setSel(sel ? null : new Set())}>{sel ? "Done" : "Select"}</button>}
                {sel && <button className="chip" style={{ height: 28 }} onClick={() => setSel(new Set(list.map((i) => i.id)))}>All</button>}
                {sel && <button className="chip" style={{ height: 28, background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" }} disabled={!sel.size || deleting} onClick={deleteSelected}>{deleting ? "Deleting…" : `Delete (${sel.size})`}</button>}
              <select className="xs" style={{ background: "none", border: 0, color: "var(--muted)" }} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
                {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              </span>
            </div>
            {loaded && items.length === 0 ? (
              <div className="empty">
                <h3>Your closet is empty</h3>
                Add photos of what you own — Capsule cuts out each piece and tags it for you.
                <div style={{ marginTop: 18 }}><button className="btn dark" onClick={() => setSheet("add")}>Add your first pieces</button></div>
              </div>
            ) : (
              <div className="grid3">
                {list.map((i) => { const f = itemFit(i, profile); const known = !!(profile.color.season || profile.body.shoulderHip); return <Tile key={i.id} item={i} selected={!!sel?.has(i.id)} onClick={() => (sel ? flip(i.id) : push({ t: "item", id: i.id }))} badge={known && f.score >= 85 ? "★ Suits you" : known && f.score < 62 ? "Selective" : i.wears === 0 ? "New" : undefined} />; })}
              </div>
            )}
          </>
        )}
        {view === "outfits" && (
          <div className="grid2" style={{ paddingTop: 14 }}>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" }}>
              {sel && <span className="xs muted" style={{ marginRight: "auto" }}>{sel.size} selected</span>}
              {outfits.length > 0 && <button className="chip" style={{ height: 28 }} onClick={() => setSel(sel ? null : new Set())}>{sel ? "Done" : "Select"}</button>}
              {sel && <button className="chip" style={{ height: 28 }} onClick={() => setSel(new Set(outfits.map((o) => o.id)))}>All</button>}
              {sel && <button className="chip" style={{ height: 28, background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" }} disabled={!sel.size || deleting} onClick={deleteSelected}>{deleting ? "Deleting…" : `Delete (${sel.size})`}</button>}
            </div>
            <button className="ocard new" onClick={() => push({ t: "outfit" })}><span>＋<br />New outfit</span></button>
            {outfits.map((o) => (
              <button key={o.id} className={`ocard ${sel?.has(o.id) ? "sel" : ""}`} onClick={() => (sel ? flip(o.id) : push({ t: "outfit", outfitId: o.id }))}>
                <Collage items={o.itemIds.map((i) => itemById[i]).filter(Boolean)} />
                <div className="n">{o.name}</div>
                <div className="s">{o.itemIds.length} pieces{o.occasion ? ` · ${o.occasion}` : ""}</div>
              </button>
            ))}
          </div>
        )}
        {view === "shop" && <ShopSection />}
        {view === "boards" && (
          <div className="grid2" style={{ paddingTop: 14 }}>
            <button className="ocard new" onClick={() => setNewBoard(true)}><span>＋<br />New board</span></button>
            {boards.map((b) => (
              <button key={b.id} className="board-card" onClick={() => push({ t: "board", id: b.id })}>
                <div className="pv">
                  {[0, 1, 2, 3].map((k) => (
                    <div key={k}>{b.previews[k] && <Img name={b.previews[k]} alt="" />}</div>
                  ))}
                </div>
                <div className="n" style={{ fontFamily: "var(--serif)", fontSize: 15, margin: "6px 4px 0" }}>{b.name}</div>
                <div className="s xs muted" style={{ margin: "0 4px 4px" }}>{b.count} saved</div>
              </button>
            ))}
          </div>
        )}
      </div>
      {newBoard && <NewBoardSheet onClose={() => setNewBoard(false)} />}
    </>
  );
}

/* ============================== CAPSULE (analytics) ============================== */
export function CapsuleTab() {
  const { items, push, wears } = useStore();
  const [view, setView] = useState<"plans" | "insights">("plans");
  const priced = items.filter((i) => i.price != null);
  const value = priced.reduce((a, i) => a + (i.price ?? 0), 0);
  const worn = items.filter((i) => i.wears > 0 && i.price != null);
  const avgCpw = worn.length ? worn.reduce((a, i) => a + (i.price ?? 0) / i.wears, 0) / worn.length : null;
  const never = items.filter((i) => i.wears === 0);
  const most = [...items].sort((a, b) => b.wears - a.wears).filter((i) => i.wears > 0).slice(0, 5);
  const byCat = CATEGORIES.map((c) => [c, items.filter((i) => i.category === c).length] as const).filter(([, n]) => n > 0);
  const maxN = Math.max(1, ...byCat.map(([, n]) => n));

  const Row = ({ list }: { list: typeof items }) => (
    <div className="chips" style={{ padding: 0 }}>
      {list.map((i) => (
        <button key={i.id} className="tile" style={{ width: 86, flex: "none" }} onClick={() => push({ t: "item", id: i.id })}>
          <div className="img" style={{ aspectRatio: "1/1" }}><Img name={i.image} alt={i.name} /></div>
          <div className="t" style={{ marginTop: 4 }}>{i.wears ? `${i.wears}× worn` : "Never worn"}</div>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="hdr"><h1 className="title">Capsule</h1></div>
      <div className="seg">
        <button className={view === "plans" ? "on" : ""} onClick={() => setView("plans")}>Plans</button>
        <button className={view === "insights" ? "on" : ""} onClick={() => setView("insights")}>Insights</button>
      </div>
      <div className="scroll">
        {view === "plans" ? <><ToBuyCard /><PlansSection /></> : items.length === 0 ? (
          <div className="empty"><h3>Nothing to analyse yet</h3>Add items and log what you wear — Capsule will show cost-per-wear, what you never wear, and your category mix.</div>
        ) : (
          <>
            <div className="sec" style={{ paddingTop: 8 }}>
              <div className="stat">
                <div><b>{items.length}</b><span className="xs muted">pieces</span></div>
                <div><b>{value ? money(value) : "—"}</b><span className="xs muted">tracked value</span></div>
                <div><b>{avgCpw != null ? money(avgCpw) : "—"}</b><span className="xs muted">avg cost / wear</span></div>
              </div>
              <div className="xs muted" style={{ marginTop: 8 }}>{wears.filter((w) => !w.planned).length} outfit{wears.filter((w) => !w.planned).length === 1 ? "" : "s"} logged. Add prices on item pages to unlock cost-per-wear.</div>
            </div>
            <div className="sec">
              <h3>By category</h3>
              {byCat.map(([c, n]) => (
                <div key={c} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontSize: 13.5 }}>
                  <span style={{ width: 86 }}>{c}</span>
                  <div className="prog" style={{ flex: 1 }}><i style={{ width: `${(n / maxN) * 100}%` }} /></div>
                  <span className="muted" style={{ width: 22, textAlign: "right" }}>{n}</span>
                </div>
              ))}
            </div>
            <InsightsPlus />
            <Rediscover />
            <ClosetReview />
            {most.length > 0 && <div className="sec"><h3>Most worn</h3><Row list={most} /></div>}
            {never.length > 0 && <div className="sec"><h3>Never worn · {never.length}</h3><Row list={never.slice(0, 12)} /></div>}
          </>
        )}
      </div>
    </>
  );
}

/* ============================== ME ============================== */
function TasteCard() {
  const { feedback, refresh, toast } = useStore();
  if (!feedback.length) return null;
  const likes = feedback.filter((f) => f.rating > 0).length, dislikes = feedback.length - likes;
  const tags = Object.entries(feedback.flatMap((f) => f.tags).reduce<Record<string, number>>((m, t) => ((m[t] = (m[t] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return (
    <div className="sec">
      <h3>What Capsule has learned</h3>
      <div className="card" style={{ padding: 14 }}>
        <div className="sm">{likes} look{likes === 1 ? "" : "s"} you liked · {dislikes} you passed on{tags.length ? ` · most common complaint: ${tags[0][0].toLowerCase()}` : ""}.</div>
        <p className="xs muted" style={{ margin: "6px 0 10px", lineHeight: 1.5 }}>Likes and passes nudge future suggestions toward pieces and pairings you enjoy. It stays on this computer.</p>
        <button className="btn light sm" onClick={async () => { if (!confirm("Forget everything Capsule has learned from your likes and passes?")) return; await api.clearFeedback(); await refresh(); toast("Learned taste reset"); }}>Reset learned taste</button>
      </div>
    </div>
  );
}

export function MeTab() {
  const { items, outfits, boards, refresh, toast } = useStore();
  const [st, setSt] = useState<Awaited<ReturnType<typeof api.settings>> | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  async function exportAll() {
    const blob = new Blob([JSON.stringify(await api.exportAll())], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `capsule-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  const loadedOnce = useRef(false);
  if (!loadedOnce.current) { loadedOnce.current = true; api.settings().then(setSt).catch(() => {}); }

  async function doImport(f: File) {
    if (!confirm("Importing replaces your entire current library. Continue?")) return;
    setBusy(true);
    try {
      const r = await api.importData(JSON.parse(await f.text()));
      await refresh();
      toast(`Imported ${r.items} items, ${r.outfits} outfits, ${r.boards} boards`);
    } catch (e) { toast(e instanceof Error ? e.message : "Import failed"); }
    setBusy(false);
  }

  return (
    <>
      <div className="hdr"><h1 className="title">Me</h1></div>
      <div className="scroll cols">
        <div className="sec span" style={{ paddingTop: 8 }}>
          <div className="stat">
            <div><b>{items.length}</b><span className="xs muted">pieces</span></div>
            <div><b>{outfits.length}</b><span className="xs muted">outfits</span></div>
            <div><b>{boards.length}</b><span className="xs muted">boards</span></div>
          </div>
        </div>
        <div className="sec">
          <h3>Your style profile</h3>
          <StyleHub />
          <p className="xs muted" style={{ marginTop: 8, lineHeight: 1.5 }}>Photos are read by your AI service for one question and not stored — only the results are kept.</p>
        </div>
        <PrivacyCard />
        <StylistCard />
        <AvatarCard />
        <GroomingCard />
        <TasteCard />
        <ShoppingSettings />
        <AiCard />
        <BrainCard />
        <div className="sec">
          <h3>Your data</h3>
          <div className="card">
            <button className="opt" style={{ border: 0, margin: 0 }} onClick={exportAll}>
              <span><b>Export everything</b><span className="xs muted">One JSON file with all items, outfits, boards and photos</span></span>
            </button>
            <button className="opt" style={{ border: 0, borderTop: "1px solid var(--line)", borderRadius: 0, margin: 0 }} disabled={busy} onClick={() => file.current?.click()}>
              <span><b>Import a backup</b><span className="xs muted">Replaces your current library</span></span>
            </button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) doImport(f); }} />
          </div>
          <p className="xs muted" style={{ marginTop: 8, lineHeight: 1.5 }}>Everything is stored locally in the app’s data folder. Nothing leaves your computer except photos sent for AI tagging.</p>
        </div>
        <div className="sec"><div className="card" style={{ padding: 14, fontSize: 13.5, lineHeight: 1.5 }}>
          <b>Coming next:</b> colour season, body proportions and face shape (Phase 2), outfits from your own closet (2B), shop-the-look (3), avatar and try-on (5), grooming (6).
        </div></div>
      </div>
    </>
  );
}
