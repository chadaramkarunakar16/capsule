"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { BoardSummary, Feedback, Item, Outfit, Wear } from "@/lib/types";
import type { Look, Product } from "@/lib/shop/types";
import type { SavedCapsule } from "@/lib/types";
import { buildTaste, type GItem, type Taste } from "@/lib/style/generate";
import { EMPTY_PROFILE, type Profile } from "@/lib/style/profile";

export type Overlay =
  | { t: "item"; id: string }
  | { t: "review" }
  | { t: "outfit"; outfitId?: string; itemIds?: string[] }
  | { t: "board"; id: string }
  | { t: "log"; date: string }
  | { t: "style"; section: "all" | "basics" | "body" | "color" | "face" }
  | { t: "palette" }
  | { t: "look"; id: string }
  | { t: "avatar" }
  | { t: "privacy" }
  | { t: "grooming" }
  | { t: "groomstyle"; kind: "hair" | "beard" | "glasses"; id: string }
  | { t: "glassesphoto"; frame?: string }
  | { t: "tryon"; itemIds: string[]; name?: string }
  | { t: "lineup"; looks: { label: string; itemIds: string[] }[]; title?: string }
  | { t: "phototryon"; itemIds: string[] }
  | { t: "capsule"; id?: string; kind?: "capsule" | "trip"; goal?: string }
  | { t: "findpiece"; piece: import("@/lib/shop/types").Piece }
  | { t: "customize"; itemIds: string[]; name: string; occasionKey?: string; target?: number; weather?: { temp: number; rain?: boolean } | null; date?: string };

type Ctx = {
  items: Item[];          // active items only
  drafts: Item[];         // awaiting review
  itemById: Record<string, Item>;
  capsules: SavedCapsule[];
  looks: Look[];
  wishlist: Product[];
  gitems: GItem[];        // active items shaped for the stylist
  taste: Taste;
  feedback: Feedback[];
  profile: Profile;
  saveProfile: (p: Profile) => Promise<void>;
  outfits: Outfit[];
  wears: Wear[];
  boards: BoardSummary[];
  loaded: boolean;
  refresh: () => Promise<void>;
  toast: (m: string) => void;
  toastMsg: string | null;
  stack: Overlay[];
  push: (o: Overlay) => void;
  pop: () => void;
  sheet: "add" | "shop" | null;
  setSheet: (s: "add" | "shop" | null) => void;
};

const C = createContext<Ctx>(null as never);
export const useStore = () => useContext(C);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [all, setAll] = useState<Item[]>([]);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [capsules, setCapsules] = useState<SavedCapsule[]>([]);
  const [looks, setLooks] = useState<Look[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [wears, setWears] = useState<Wear[]>([]);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [stack, setStack] = useState<Overlay[]>([]);
  const [sheet, setSheet] = useState<"add" | "shop" | null>(null);
  const tt = useRef<ReturnType<typeof setTimeout>>(undefined);

  const refresh = useCallback(async () => {
    const [i, o, w, b, pr, fb, lk, wl, cp] = await Promise.all([api.items(), api.outfits(), api.wears(), api.boards(), api.profile(), api.feedback(), api.looks(), api.products(true), api.capsules()]);
    setCapsules(cp);
    setLooks(lk);
    setWishlist(wl);
    setProfile(pr);
    setFeedback(fb);
    setAll(i);
    setOutfits(o);
    setWears(w);
    setBoards(b);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh().catch((e) => {
      console.error(e);
      setLoaded(true);
    });
  }, [refresh]);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    clearTimeout(tt.current);
    tt.current = setTimeout(() => setToastMsg(null), 2200);
  }, []);

  const value = useMemo<Ctx>(() => {
    const items = all.filter((i) => i.status !== "draft");
    return {
      items,
      drafts: all.filter((i) => i.status === "draft"),
      itemById: Object.fromEntries(all.map((i) => [i.id, i])),
      capsules,
      looks,
      wishlist,
      gitems: items.map((i) => ({ id: i.id, name: i.name, category: i.category, colorHex: i.colorHex, colorName: i.colorName, fit: i.fit, formality: i.formality, pattern: i.pattern, attrs: i.attrs, season: i.season, wears: i.wears, lastWorn: i.lastWorn, createdAt: i.createdAt })),
      taste: buildTaste(feedback, new Set(items.map((i) => i.id))),
      feedback,
      profile,
      saveProfile: async (p) => { setProfile(await api.saveProfile(p)); },
      outfits, wears, boards, loaded, refresh, toast, toastMsg, stack, sheet, setSheet,
      push: (o) => setStack((s) => [...s, o]),
      pop: () => setStack((s) => s.slice(0, -1)),
    };
  }, [all, capsules, looks, wishlist, feedback, profile, outfits, wears, boards, loaded, refresh, toast, toastMsg, stack, sheet]);

  return <C.Provider value={value}>{children}</C.Provider>;
}
