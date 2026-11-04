"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, img } from "@/lib/api";
import { generate, nameFor, parseIntent, reviewCloset, type Context, type GItem, type Generated, type Intent, type Weather } from "@/lib/style/generate";
import { outfitFit } from "@/lib/style/score";
import { deviceLocation, forecast, geocode, loadLoc, saveLoc, type Loc, type Wx } from "@/lib/weather";
import { CAT_ORDER, type Item } from "@/lib/types";
import { Collage, I, Ico, Overlay, Sheet, fmtDate, iso, today, Img } from "./ui";
import { FitCard } from "./style";
import { useStore } from "./store";

const SUGGESTIONS = ["Style me for work tomorrow", "Brunch with friends", "Dinner date, a bit dressy", "Rediscover things I rarely wear", "Cold and rainy day"];
const DISLIKE_TAGS = ["Colours clash", "Too dressy", "Too casual", "Don’t like this pairing", "Not my style", "Wrong for the weather"];

function useItems(ids: string[]): Item[] {
  const { itemById } = useStore();
  return ids.map((i) => itemById[i]).filter(Boolean).sort((a, b) => (CAT_ORDER[a.category] ?? 9) - (CAT_ORDER[b.category] ?? 9));
}

/** All the pieces of a look on one stage (3 columns when there are many). */
export function LookStage({ items }: { items: Item[] }) {
  return (
    <div className="stage" style={{ margin: "10px 0 0", minHeight: 0 }}>
      <div className={`stage-grid ${items.length >= 5 ? "c3" : ""}`}>
        {items.map((c) => (
          <div className="slot" key={c.id}><Img name={c.image} alt={c.name} /></div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ actions: wear / plan / save */

export function LookActions({ itemIds, name, occasion, onChanged }: { itemIds: string[]; name: string; occasion?: string; onChanged?: () => void }) {
  const { refresh, toast, push } = useStore();
  const [plan, setPlan] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try { await fn(); await refresh(); toast(msg); onChanged?.(); } catch (e) { toast(e instanceof Error ? e.message : "Something went wrong"); }
    setBusy(false);
  }
  const days = Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() + k + 1); return iso(d); });
  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn dark sm" style={{ flex: 1 }} disabled={busy} onClick={() => run(() => api.logWear({ date: today(), itemIds }), "Logged as worn today")}>Wear today</button>
        <button className="btn light sm" style={{ flex: 1 }} disabled={busy} onClick={() => setPlan(true)}>Plan…</button>
        <button className="btn light sm" style={{ flex: 1 }} disabled={busy} onClick={() => run(() => api.createOutfit({ name, occasion: occasion ?? "", itemIds }), "Saved to Outfits")}>Save</button>
        <button className="btn light sm" style={{ flex: 1 }} onClick={() => push({ t: "tryon", itemIds, name })}>On me</button>
      </div>
      {plan && (
        <Sheet onClose={() => setPlan(false)}>
          <h2 className="h-l" style={{ marginBottom: 12 }}>Plan this look</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {days.map((d, k) => (
              <button key={d} className="opt" style={{ margin: 0 }} onClick={() => { setPlan(false); run(() => api.logWear({ date: d, itemIds, planned: true }), `Planned for ${fmtDate(d)}`); }}>
                <span><b>{k === 0 ? "Tomorrow" : fmtDate(d)}</b><span className="xs muted">{fmtDate(d)}</span></span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}

function DislikeSheet({ itemIds, context, onClose, onDone }: { itemIds: string[]; context: string; onClose: () => void; onDone: () => void }) {
  const { refresh, toast } = useStore();
  const [tags, setTags] = useState<string[]>([]);
  async function send() {
    await api.addFeedback({ itemIds, rating: -1, tags, context });
    await refresh();
    toast("Noted — Capsule will steer away from this");
    onDone();
  }
  return (
    <Sheet onClose={onClose}>
      <h2 className="h-l" style={{ marginBottom: 4 }}>What’s off?</h2>
      <p className="sm muted" style={{ marginBottom: 12 }}>Pick any that apply — it helps Capsule learn your taste.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {DISLIKE_TAGS.map((t) => <button key={t} className={`chip ${tags.includes(t) ? "on" : ""}`} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}>{t}</button>)}
      </div>
      <button className="btn dark full" onClick={send}>Not for me</button>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ weather */

function WeatherSheet({ onClose, onSet }: { onClose: () => void; onSet: (l: Loc | null) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Loc[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function find() {
    if (!q.trim()) return;
    setBusy(true); setMsg(null);
    try { const r = await geocode(q.trim()); setRes(r); if (!r.length) setMsg("No matching place found"); } catch (e) { setMsg(e instanceof Error ? e.message : "Lookup failed"); }
    setBusy(false);
  }
  async function here() {
    setBusy(true); setMsg(null);
    try { onSet(await deviceLocation()); } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't get your location"); }
    setBusy(false);
  }
  return (
    <Sheet onClose={onClose}>
      <h2 className="h-l" style={{ marginBottom: 6 }}>Weather-aware outfits</h2>
      <p className="sm muted" style={{ marginBottom: 12, lineHeight: 1.5 }}>Capsule can check the forecast so it layers up when it’s cold and skips the coat when it’s warm. Only the coordinates of the place you choose are sent to Open-Meteo (a free weather service). You can turn this off any time.</p>
      <button className="btn dark full" disabled={busy} onClick={here}>Use my location</button>
      <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
        <input className="input" placeholder="or search a city" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && find()} />
        <button className="btn light" disabled={busy} onClick={find}>Search</button>
      </div>
      {msg && <div className="sm" style={{ color: "var(--danger)", marginBottom: 8 }}>{msg}</div>}
      {res.map((l) => <button key={l.name + l.lat} className="opt" style={{ marginBottom: 6 }} onClick={() => onSet(l)}><span><b>{l.name}</b></span></button>)}
      {loadLoc() && <button className="btn danger full" style={{ marginTop: 8 }} onClick={() => onSet(null)}>Turn weather off</button>}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ Today: "Style me" */

export function StyleMeCard() {
  const { gitems, itemById, profile, taste, push, refresh, toast, loaded } = useStore();
  const [q, setQ] = useState("");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [list, setList] = useState<Generated[]>([]);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loc, setLoc] = useState<Loc | null>(null);
  const [wx, setWx] = useState<Wx | null>(null);
  const [wxSheet, setWxSheet] = useState(false);
  const [dislike, setDislike] = useState(false);
  const [liked, setLiked] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => { setLoc(loadLoc()); }, []);
  useEffect(() => {
    if (!loc) { setWx(null); return; }
    forecast(loc).then(setWx).catch(() => setWx(null));
  }, [loc]);

  const have = (c: string) => gitems.some((i) => i.category === c);
  const canBuild = (have("Tops") && have("Bottoms")) || have("Dresses");

  const run = useCallback((text: string, opts?: { rediscover?: boolean }) => {
    const my = ++seq.current;
    setBusy(true);
    // yield to the browser so the spinner paints before the (synchronous) search runs
    setTimeout(() => {
      const it = parseIntent(text, gitems);
      const weather: Weather | null = it.weather ?? (wx ? { temp: wx.temp, rain: wx.rain } : null);
      const ctx: Context = {
        today: today(), target: it.target, weather, must: it.must, onlyColourNear: it.colourHue ?? null,
        rediscover: opts?.rediscover || /rediscover|rarely|forgot|haven.?t worn|new ways/i.test(text), withBag: it.withBag,
      };
      const out = generate(gitems, profile, taste, ctx, 12);
      if (my !== seq.current) return;
      setIntent(it); setList(out); setIdx(0); setLiked(null); setBusy(false);
    }, 30);
  }, [gitems, profile, taste, wx]);

  // first suggestion once data is in, and again if the closet / weather changes
  const sig = `${gitems.length}|${wx ? wx.temp + (wx.rain ? "r" : "") : "-"}`;
  useEffect(() => { if (loaded && canBuild && !q) run(""); /* eslint-disable-next-line */ }, [loaded, sig, canBuild]);

  const cur = list[idx];
  const items = useItems(cur ? cur.items.map((i) => i.id) : []);
  const occKey = intent?.key ?? "def";
  const title = cur ? nameFor(cur, occKey, idx) : "";
  const weatherLine = wx ? `${wx.label} · ${wx.temp}°C · H${wx.hi}° L${wx.lo}°` : null;

  async function like() {
    if (!cur) return;
    await api.addFeedback({ itemIds: cur.items.map((i) => i.id), rating: 1, context: q });
    setLiked(cur.key);
    toast("Saved — Capsule will lean toward looks like this");
    refresh();
  }

  return (
    <div style={{ padding: "12px 20px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 className="h-l" style={{ fontSize: 20 }}>Style me</h2>
        <button className="chip" onClick={() => setWxSheet(true)}>{weatherLine ? `☁ ${weatherLine}` : "＋ Add weather"}</button>
      </div>

      {!loaded ? null : gitems.length === 0 ? (
        <div className="card empty" style={{ padding: "28px 20px" }}>Add a few pieces and Capsule will start building outfits from them.</div>
      ) : !canBuild ? (
        <div className="card empty" style={{ padding: "28px 20px" }}>
          To build outfits Capsule needs at least {have("Tops") || have("Bottoms") ? "" : "tops and bottoms (or a dress)"}
          {have("Tops") && !have("Bottoms") ? "a pair of bottoms" : ""}{have("Bottoms") && !have("Tops") ? "a top" : ""}.
        </div>
      ) : (
        <>
          <div className="prompt" style={{ margin: "0 0 10px" }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(q)} placeholder="Dinner date, a bit dressy…" autoComplete="off" />
            <button onClick={() => run(q)} aria-label="Style me"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
          </div>
          <div className="sugg">
            {SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => { setQ(s); run(s); }}>{s}</button>)}
          </div>

          {busy && !cur ? <div className="card empty thinking" style={{ padding: 30 }}>Putting looks together…</div> : !cur ? (
            <div className="card empty" style={{ padding: "28px 20px" }}>No outfit fits those constraints with what you own. Try loosening the request.</div>
          ) : (
            <div className={`card ${busy ? "thinking" : ""}`} style={{ padding: 14, background: "var(--stage)", border: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <h3 className="h-l" style={{ fontSize: 21 }}>{title}</h3>
                <span className="chipscore"><i style={{ background: cur.score >= 80 ? "var(--good)" : "var(--warn)" }} />Suits you {cur.score}%</span>
              </div>
              <LookStage items={items} />
              <div className="reason" style={{ padding: 0, marginTop: 10 }}>
                {[...cur.reasons.slice(0, 2).map((r) => r.text), ...cur.note.slice(0, 1)].map((t, k) => <div key={k}>{k === 0 ? <b>Why it works: </b> : "· "}{t}.</div>)}
                <div className="xs muted" style={{ marginTop: 6 }}>Built only from clothes you own · {idx + 1} of {list.length}{intent?.text ? ` · “${intent.text}”` : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 8, margin: "12px 0 8px" }}>
                <button className="btn light sm" style={{ flex: 1 }} onClick={() => { setIdx((idx + 1) % list.length); setLiked(null); }}>↻ Another</button>
                <button className="btn dark sm" style={{ flex: 1 }} onClick={() => push({ t: "customize", itemIds: cur.items.map((i) => i.id), name: title, occasionKey: occKey, target: intent?.target, weather: intent?.weather ?? (wx ? { temp: wx.temp, rain: wx.rain } : null) })}>Customize</button>
                <button className="btn light sm" style={{ width: 42, padding: 0, color: liked === cur.key ? "var(--accent)" : undefined }} aria-label="Like" onClick={like}>{liked === cur.key ? "♥" : "♡"}</button>
                <button className="btn light sm" style={{ width: 42, padding: 0 }} aria-label="Dislike" onClick={() => setDislike(true)}>👎</button>
              </div>
              <LookActions itemIds={cur.items.map((i) => i.id)} name={title} occasion={intent && intent.key !== "def" ? intent.label : ""} />
            </div>
          )}
        </>
      )}
      {wxSheet && (
        <WeatherSheet
          onClose={() => setWxSheet(false)}
          onSet={(l) => { saveLoc(l); setLoc(l); setWxSheet(false); toast(l ? `Weather on for ${l.name}` : "Weather off"); }}
        />
      )}
      {dislike && cur && (
        <DislikeSheet itemIds={cur.items.map((i) => i.id)} context={q} onClose={() => setDislike(false)} onDone={() => { setDislike(false); setList((l) => l.filter((_, k) => k !== idx)); setIdx(0); }} />
      )}
      {/* itemById referenced so the card re-renders when images change */}
      <span hidden>{Object.keys(itemById).length}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ Customize: swipe rows with live score */

type Row = { cat: string; optional: boolean };

export function Customize({ itemIds, name, occasionKey, target, weather }: { itemIds: string[]; name: string; occasionKey?: string; target?: number; weather?: Weather | null }) {
  const { gitems, itemById, profile, pop } = useStore();
  const start = itemIds.map((i) => gitems.find((g) => g.id === i)).filter((g): g is GItem => !!g);
  const hasDress = start.some((i) => i.category === "Dresses");
  const rows: Row[] = useMemo(() => {
    const cats = hasDress ? ["Outerwear", "Dresses", "Shoes", "Bags"] : ["Outerwear", "Tops", "Bottoms", "Shoes", "Bags"];
    return cats.filter((c) => gitems.some((g) => g.category === c)).map((c) => ({ cat: c, optional: c === "Outerwear" || c === "Bags" }));
  }, [gitems, hasDress]);
  const [sel, setSel] = useState<Record<string, string | null>>(() => {
    const s: Record<string, string | null> = {};
    for (const r of rows) s[r.cat] = start.find((i) => i.category === r.cat)?.id ?? (r.optional ? null : gitems.find((g) => g.category === r.cat)?.id ?? null);
    return s;
  });
  const chosen = rows.map((r) => gitems.find((g) => g.id === sel[r.cat])).filter((g): g is GItem => !!g);
  const fit = outfitFit(chosen, profile, target);
  const ids = chosen.map((c) => c.id);
  const previews = ids.map((i) => itemById[i]).filter(Boolean);

  const scoreWith = (cat: string, id: string | null) => outfitFit(rows.map((r) => gitems.find((g) => g.id === (r.cat === cat ? id : sel[r.cat]))).filter((g): g is GItem => !!g), profile, target).score;

  const cars = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    // centre each row on its starting selection
    for (const r of rows) {
      const car = cars.current[r.cat];
      const el = car?.querySelector<HTMLElement>(`[data-id="${sel[r.cat] ?? "none"}"]`);
      if (car && el) car.scrollLeft = el.offsetLeft - car.clientWidth / 2 + el.offsetWidth / 2;
    }
    // eslint-disable-next-line
  }, []);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function onScroll(cat: string) {
    clearTimeout(timers.current[cat]);
    timers.current[cat] = setTimeout(() => {
      const car = cars.current[cat];
      if (!car) return;
      const mid = car.scrollLeft + car.clientWidth / 2;
      let best: HTMLElement | null = null, bd = Infinity;
      car.querySelectorAll<HTMLElement>(".cz-item").forEach((el) => { const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = el; } });
      const id = (best as HTMLElement | null)?.dataset.id;
      if (id) setSel((s) => (s[cat] === (id === "none" ? null : id) ? s : { ...s, [cat]: id === "none" ? null : id }));
    }, 90);
  }
  function center(cat: string, el: HTMLElement) {
    const car = cars.current[cat];
    car?.scrollTo({ left: el.offsetLeft - car.clientWidth / 2 + el.offsetWidth / 2, behavior: "smooth" });
  }

  return (
    <div className="overlay cz" style={{ zIndex: 35 }}>
      <div className="ov-hdr">
        <Ico label="Close" onClick={pop}>{I.close}</Ico>
        <div className="grow" style={{ textAlign: "center", paddingRight: 38 }}>{name || "Customize look"}</div>
      </div>
      <div className="ov-body">
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 10px" }}>
          <div className="cz-mini">{previews.slice(0, 6).map((c) => <div key={c.id}><Img name={c.image} alt="" /></div>)}</div>
        </div>
        <div style={{ margin: "0 16px 6px" }}><FitCard fit={fit} title="Suits you" max={2} /></div>
        {weather && <div className="xs" style={{ textAlign: "center", opacity: 0.7, marginBottom: 4 }}>Planning for {Math.round(weather.temp)}°C{weather.rain ? " and rain" : ""}</div>}
        {rows.map((r) => {
          const list = gitems.filter((g) => g.category === r.cat);
          return (
            <div className="cz-row" key={r.cat}>
              <div className="cz-lab">{r.cat}</div>
              <div className="cz-car" ref={(el) => { cars.current[r.cat] = el; }} onScroll={() => onScroll(r.cat)}>
                {r.optional && (
                  <button data-id="none" className={`cz-item none ${sel[r.cat] == null ? "sel" : ""}`} onClick={(e) => center(r.cat, e.currentTarget)}>
                    <span>None</span><em>{scoreWith(r.cat, null)}</em>
                  </button>
                )}
                {list.map((g) => {
                  const it = itemById[g.id];
                  return (
                    <button key={g.id} data-id={g.id} className={`cz-item ${sel[r.cat] === g.id ? "sel" : ""}`} onClick={(e) => center(r.cat, e.currentTarget)} aria-label={g.name}>
                      <Img name={it?.image} alt={g.name} /><em>{scoreWith(r.cat, g.id)}</em>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <p className="xs" style={{ opacity: 0.55, textAlign: "center", padding: "6px 24px 0" }}>Swipe each row — the number under a piece is the score you’d get by choosing it.</p>
      </div>
      <div className="ov-foot" style={{ background: "#0c0c0c", borderColor: "#222" }}>
        <div style={{ flex: 1 }}><LookActions itemIds={ids} name={name || "My look"} occasion={occasionKey && occasionKey !== "def" ? occasionKey : ""} onChanged={pop} /></div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Capsule tab: rediscover + closet review */

export function Rediscover() {
  const { gitems, profile, taste, push, itemById } = useStore();
  const cards = useMemo(() => {
    const under = [...gitems].filter((i) => i.wears <= 1).sort((a, b) => a.wears - b.wears).slice(0, 4);
    return under.map((a) => ({ a, g: generate(gitems, profile, taste, { today: today(), must: [a.id], rediscover: true }, 1)[0] })).filter((x) => x.g);
  }, [gitems, profile, taste]);
  if (!cards.length) return null;
  return (
    <div className="sec">
      <h3>Rediscover</h3>
      <p className="sm muted" style={{ marginBottom: 10 }}>Pieces you rarely wear, styled a new way.</p>
      <div className="grid2" style={{ padding: 0 }}>
        {cards.map(({ a, g }) => (
          <button key={a.id} className="ocard" onClick={() => push({ t: "customize", itemIds: g.items.map((i) => i.id), name: `Around your ${a.name.toLowerCase()}` })}>
            <Collage items={g.items.map((i) => itemById[i.id]).filter(Boolean)} />
            <div className="n">{a.name}</div>
            <div className="s">Suits you {g.score}% · {a.wears ? `worn ${a.wears}×` : "never worn"}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ClosetReview() {
  const { gitems, profile, taste, push, itemById } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const verdicts = useMemo(() => reviewCloset(gitems, profile, today()), [gitems, profile]);
  if (gitems.length < 3) return null;
  const groups: [string, string, string][] = [["keep", "Keep", "These earn their place."], ["restyle", "Try styling differently", "Rarely worn — a new combination might change that."], ["let-go", "Consider passing on", "Barely worn and not a strong match for your palette. Nothing is deleted — this is only a nudge."]];
  return (
    <div className="sec">
      <h3>Closet review</h3>
      {groups.map(([k, label, blurb]) => {
        const list = verdicts.filter((v) => v.verdict === k);
        if (!list.length) return null;
        return (
          <div key={k} className="card" style={{ marginBottom: 8 }}>
            <button className="line" style={{ width: "100%", background: "none", border: 0, textAlign: "left" }} onClick={() => setOpen(open === k ? null : k)}>
              <span><b style={{ fontSize: 15 }}>{label}</b><br /><span className="xs muted">{blurb}</span></span>
              <span className="pill ai">{list.length}</span>
            </button>
            {open === k && (
              <div style={{ padding: "0 14px 10px" }}>
                {list.map((v) => {
                  const it = itemById[v.id];
                  if (!it) return null;
                  return (
                    <div key={v.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                      <button style={{ width: 46, height: 52, borderRadius: 10, background: "var(--tile)", flex: "none", padding: 0, border: 0 }} onClick={() => push({ t: "item", id: it.id })} aria-label={it.name}><Img name={it.image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></button>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{it.name}</div><div className="xs muted">{v.why}</div></div>
                      {k !== "keep" && <button className="chip" onClick={() => { const g = generate(gitems, profile, taste, { today: today(), must: [v.id], rediscover: true }, 1)[0]; if (g) push({ t: "customize", itemIds: g.items.map((i) => i.id), name: `Around your ${it.name.toLowerCase()}` }); }}>Style it</button>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
