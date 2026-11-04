"use client";
import { useMemo, useState } from "react";
import { CATEGORIES } from "@/lib/types";
import { I, Tile } from "./ui";
import { useStore } from "./store";

/** Searchable, category-filtered multi-select grid of closet items. */
export function PickItems({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  const { items } = useStore();
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const list = useMemo(
    () =>
      items.filter(
        (i) =>
          (cat === "All" || i.category === cat) &&
          (!q || `${i.name} ${i.brand} ${i.colorName}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [items, cat, q],
  );
  return (
    <>
      <div className="search">
        {I.search}
        <input className="input" placeholder="Search your closet" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="chips">
        {["All", ...CATEGORIES].map((c) => (
          <button key={c} className={`chip ${c === cat ? "on" : ""}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="empty sm">No items match.</div>
      ) : (
        <div className="grid3">
          {list.map((i) => (
            <Tile key={i.id} item={i} selected={selected.includes(i.id)} onClick={() => onToggle(i.id)} />
          ))}
        </div>
      )}
    </>
  );
}
