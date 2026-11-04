"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { Collage, Overlay, fmtDate, today } from "./ui";
import { PickItems } from "./pick";
import { useStore } from "./store";

/** Log (or review) what was worn on a given date. */
export function LogWear({ date }: { date: string }) {
  const { wears, outfits, itemById, pop, refresh, toast } = useStore();
  const day = wears.filter((w) => w.date === date);
  const [mode, setMode] = useState<"outfit" | "items">(outfits.length ? "outfit" : "items");
  const [pick, setPick] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function logOutfit(id: string) {
    setBusy(true);
    await api.logWear({ date, outfitId: id, planned: date > today() });
    await refresh();
    toast("Logged");
    setBusy(false);
  }
  async function logItems() {
    setBusy(true);
    await api.logWear({ date, itemIds: pick, planned: date > today() });
    await refresh();
    setPick([]);
    toast("Logged");
    setBusy(false);
  }
  async function remove(id: string) {
    await api.deleteWear(id);
    await refresh();
  }

  return (
    <Overlay
      title={fmtDate(date)}
      onBack={pop}
      foot={mode === "items" ? <button className="btn dark full" disabled={!pick.length || busy} onClick={logItems}>Log {pick.length || ""} piece{pick.length === 1 ? "" : "s"}</button> : undefined}
    >
      {day.length > 0 && (
        <div className="sec" style={{ paddingTop: 6 }}>
          <h3>Logged</h3>
          {day.map((w) => {
            const its = w.itemIds.map((i) => itemById[i]).filter(Boolean);
            return (
              <div key={w.id} className="card" style={{ padding: 10, marginBottom: 8, display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 86, flex: "none", background: "var(--stage)", borderRadius: 12 }}><Collage items={its} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 14 }}>{outfits.find((o) => o.id === w.outfitId)?.name ?? "Custom pieces"}</b> {w.planned && <span className="pill guess">Planned</span>}
                  <div className="xs muted">{its.map((i) => i.name).join(" · ")}</div>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {w.planned && date <= today() && <button className="chip on" onClick={async () => { await api.patchWear(w.id, { planned: false }); await refresh(); toast("Logged as worn"); }}>I wore it</button>}
                  <button className="chip" onClick={() => remove(w.id)}>Remove</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="sec" style={{ paddingTop: 14 }}>
        <h3>{day.length ? "Add another" : "What did you wear?"}</h3>
      </div>
      <div className="seg">
        <button className={mode === "outfit" ? "on" : ""} onClick={() => setMode("outfit")}>Saved outfit</button>
        <button className={mode === "items" ? "on" : ""} onClick={() => setMode("items")}>Pick pieces</button>
      </div>
      {mode === "outfit" ? (
        outfits.length === 0 ? (
          <div className="empty sm">No saved outfits yet. Build one from Closet → Outfits, or pick pieces directly.</div>
        ) : (
          <div className="grid2">
            {outfits.map((o) => (
              <button key={o.id} className="ocard" disabled={busy} onClick={() => logOutfit(o.id)}>
                <Collage items={o.itemIds.map((i) => itemById[i]).filter(Boolean)} />
                <div className="n">{o.name}</div>
                <div className="s">Tap to log</div>
              </button>
            ))}
          </div>
        )
      ) : (
        <PickItems selected={pick} onToggle={(id) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))} />
      )}
    </Overlay>
  );
}
