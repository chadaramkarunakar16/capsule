import { apiFetch, imageUrlSync } from "./engine";
import type { Profile } from "./style/profile";
import type { Candidate, Look, Piece, Product } from "./shop/types";
import type { Board, BoardEntry, BoardSummary, Feedback, Item, Outfit, SavedCapsule, Tags, Wear } from "./types";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await apiFetch(url, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j as T;
}
const send = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const imgPath = (name: string, w?: number) => `/api/img/${name}${w ? `?w=${w}` : ""}`;
export const img = (name: string | null | undefined, w?: number) => (name ? imageUrlSync(imgPath(name, w)) : "");

export const api = {
  items: () => req<Item[]>("/api/items"),
  createItem: (b: Partial<Item> & { image: string }) => req<Item>("/api/items", send("POST", b)),
  updateItem: (id: string, b: Partial<Item>) => req<Item>(`/api/items/${id}`, send("PATCH", b)),
  deleteItem: (id: string) => req(`/api/items/${id}`, send("DELETE")),
  upload: (cutout: Blob, original?: Blob) => {
    const f = new FormData();
    f.append("cutout", new File([cutout], "cutout", { type: cutout.type }));
    if (original) f.append("original", new File([original], "original", { type: original.type }));
    return req<{ image: string; original: string | null }>("/api/upload", { method: "POST", body: f });
  },
  tag: (image: string) => req<{ aiAvailable: boolean; tags?: Tags }>("/api/tag", send("POST", { image })),

  outfits: () => req<Outfit[]>("/api/outfits"),
  createOutfit: (b: { name: string; occasion?: string; itemIds: string[] }) => req<Outfit>("/api/outfits", send("POST", b)),
  updateOutfit: (id: string, b: Partial<Outfit>) => req<Outfit>(`/api/outfits/${id}`, send("PATCH", b)),
  deleteOutfit: (id: string) => req(`/api/outfits/${id}`, send("DELETE")),

  wears: (from?: string, to?: string) => req<Wear[]>(from && to ? `/api/wears?from=${from}&to=${to}` : "/api/wears"),
  logWear: (b: { date: string; outfitId?: string; itemIds?: string[]; planned?: boolean }) => req<Wear>("/api/wears", send("POST", b)),
  patchWear: (id: string, b: { planned?: boolean; date?: string }) => req(`/api/wears/${id}`, send("PATCH", b)),
  feedback: () => req<Feedback[]>("/api/feedback"),
  addFeedback: (b: { itemIds: string[]; rating: 1 | -1; tags?: string[]; context?: string }) => req("/api/feedback", send("POST", b)),
  clearFeedback: () => req("/api/feedback", send("DELETE")),
  split: (image: string) => req<{ aiAvailable: boolean; pieces?: { name: string; category: string; box: [number, number, number, number] }[] }>("/api/split", send("POST", { image })),
  deleteWear: (id: string) => req(`/api/wears/${id}`, send("DELETE")),

  boards: () => req<BoardSummary[]>("/api/boards"),
  createBoard: (name: string) => req<BoardSummary>("/api/boards", send("POST", { name })),
  board: (id: string) => req<Board>(`/api/boards/${id}`),
  renameBoard: (id: string, name: string) => req(`/api/boards/${id}`, send("PATCH", { name })),
  deleteBoard: (id: string) => req(`/api/boards/${id}`, send("DELETE")),
  addEntry: (id: string, b: { kind: "item" | "outfit" | "image"; refId?: string; image?: string; note?: string; url?: string }) =>
    req<BoardEntry & { duplicate?: boolean }>(`/api/boards/${id}/entries`, send("POST", b)),
  updateEntry: (id: string, entryId: string, b: { note?: string; url?: string }) => req(`/api/boards/${id}/entries/${entryId}`, send("PATCH", b)),
  deleteEntry: (id: string, entryId: string) => req(`/api/boards/${id}/entries/${entryId}`, send("DELETE")),

  profile: () => req<Profile>("/api/profile"),
  saveProfile: (p: Profile) => req<Profile>("/api/profile", send("PUT", p)),

  capsules: () => req<SavedCapsule[]>("/api/capsules"),
  createCapsule: (b: Partial<SavedCapsule> & { name: string; itemIds: string[] }) => req<SavedCapsule>("/api/capsules", send("POST", b)),
  patchCapsule: (id: string, b: Partial<SavedCapsule>) => req<SavedCapsule>(`/api/capsules/${id}`, send("PATCH", b)),
  deleteCapsule: (id: string) => req(`/api/capsules/${id}`, send("DELETE")),

  looks: () => req<Look[]>("/api/looks"),
  createLook: (b: { image: string; sourceUrl?: string; note?: string }) => req<Look>("/api/looks", send("POST", b)),
  look: (id: string) => req<Look & { products: Product[] }>(`/api/looks/${id}`),
  patchLook: (id: string, b: { pieces?: Piece[]; note?: string; sourceUrl?: string }) => req<Look>(`/api/looks/${id}`, send("PATCH", b)),
  deleteLook: (id: string) => req(`/api/looks/${id}`, send("DELETE")),
  analyseLook: (id: string) => req<{ aiAvailable: boolean; look?: Look }>(`/api/looks/${id}/analyse`, send("POST")),
  shopSearch: (query: string) => req<{ providerAvailable: boolean; candidates: Candidate[]; links: { name: string; url: string }[]; error?: string }>("/api/shop/search", send("POST", { query })),
  previewProduct: (url: string) => req<Candidate>("/api/shop/preview", send("POST", { url })),
  products: (saved = true) => req<Product[]>(`/api/products${saved ? "?saved=1" : ""}`),
  addProduct: (b: Partial<Product> & { title: string; url: string }) => req<Product>("/api/products", send("POST", b)),
  patchProduct: (id: string, b: { selected?: boolean; saved?: boolean }) => req<Product | { removed: true }>(`/api/products/${id}`, send("PATCH", b)),
  deleteProduct: (id: string) => req(`/api/products/${id}`, send("DELETE")),
  refreshProduct: (id: string) => req<Product>(`/api/products/${id}/refresh`, send("POST")),

  avatarImage: (b: { photo?: string | null; facePhoto?: string | null }) => req<{ available: boolean; image?: string }>("/api/avatar/generate", send("POST", b)),

  advice: (b: { topic: "grooming" | "outfits"; occasion?: string; useFacePhoto?: boolean }) => req<{ available: boolean; usedPhoto?: boolean; advice?: Advice }>("/api/advice", send("POST", b)),

  tryon: (b: { person: string; garments: { image: string; category: string }[] }) => req<{ available: boolean; image?: string; steps?: number; provider?: string }>("/api/tryon", send("POST", b)),

  inventory: () => req<{ rows: Record<string, number>; profile: boolean; photos: { files: number; bytes: number }; thumbs: { files: number; bytes: number }; models: { files: number; bytes: number }; keys: { anthropic: boolean; serpapi: boolean; fashn: boolean }; pin: boolean }>("/api/privacy/inventory"),
  wipe: async (b: { confirm: string; keys?: boolean; models?: boolean }) => {
    const r = await req<{ ok: boolean; removed: { photos: number } }>("/api/privacy/wipe", send("POST", b));
    // the offline copy of pictures and pages goes too
    try { (await navigator.serviceWorker?.getRegistration())?.active?.postMessage("wipe"); } catch { /* no service worker */ }
    return r;
  },
  pinStatus: () => req<{ pin: boolean }>("/api/auth/pin"),
  setPin: (b: { current?: string; pin: string | null }) => req<{ ok: boolean; pin: boolean }>("/api/auth/pin", send("POST", b)),
  logout: () => req("/api/auth/logout", send("POST")),
  exportAll: () => req<unknown>("/api/export"),

  settings: () => req<{ aiProvider: "gemini" | "anthropic" | null; geminiHint: string | null; geminiFromEnv: boolean; aiQuality: "economy" | "better"; aiModels: Record<"economy" | "better", Record<"tag" | "split" | "look" | "advice", string>>; aiUsage: { calls: number; inTok: number; outTok: number; byModel: Record<string, number> }; tryonAvailable: boolean; tryonProvider: "gemini" | "fashn" | null; tryonHasFashn: boolean; tryonHasGemini: boolean; tryonModel: string; tryonKeyHint: string | null; tryonKeyFromEnv: boolean; aiAvailable: boolean; keyHint: string | null; keyFromEnv: boolean; model: string; country: string; shopAvailable: boolean; shopKeyHint: string | null; shopKeyFromEnv: boolean }>("/api/settings"),
  saveSettings: (b: { tryonProvider?: "gemini" | "fashn"; geminiKey?: string; aiQuality?: "economy" | "better"; fashnKey?: string; anthropicKey?: string; model?: string; serpApiKey?: string; country?: string }) => req("/api/settings", send("POST", b)),
  importData: (data: unknown) => req<{ items: number; outfits: number; boards: number }>("/api/import", send("POST", data)),
};

export type Advice = {
  summary: string;
  hair?: { id: string; why: string }[]; beard?: { id: string; why: string }[]; glasses?: { id: string; why: string }[]; sunglasses?: string; tips?: string[];
  do?: string[]; avoid?: string[]; outfits?: { name: string; items: string[]; why: string }[];
};
