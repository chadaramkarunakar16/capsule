export const CATEGORIES = ["Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Bags", "Accessories"] as const;
export type Category = (typeof CATEGORIES)[number];
export const CAT_ORDER: Record<string, number> = { Outerwear: 0, Tops: 1, Dresses: 2, Bottoms: 3, Shoes: 4, Bags: 5, Accessories: 6 };

export type Item = {
  id: string;
  name: string;
  brand: string;
  category: string;
  colorName: string;
  colorHex: string;
  pattern: string;
  fit: string;
  formality: number;
  season: string;
  size: string;
  price: number | null;
  purchaseDate: string | null;
  notes: string;
  attrs: Record<string, unknown>;
  image: string;
  original: string | null;
  status: "active" | "draft" | string;
  aiTagged: boolean;
  createdAt: string;
  wears: number;
  lastWorn: string | null;
};

export type Outfit = { id: string; name: string; occasion: string; createdAt: string; itemIds: string[] };
export type Wear = { id: string; date: string; outfitId: string | null; note: string; planned: boolean; itemIds: string[] };
export type Feedback = { id: string; itemIds: string[]; rating: 1 | -1; tags: string[]; context: string; createdAt: string };
export type BoardSummary = { id: string; name: string; count: number; previews: string[] };
export type BoardEntry = { id: string; boardId: string; kind: "item" | "outfit" | "image"; refId: string | null; image: string | null; note: string; url: string };
export type Board = { id: string; name: string; entries: BoardEntry[] };

export type Tags = Partial<Pick<Item, "name" | "brand" | "category" | "colorName" | "colorHex" | "pattern" | "fit" | "formality" | "season" | "attrs">>;

export type SavedCapsule = {
  id: string;
  kind: "capsule" | "trip";
  name: string;
  config: import("./style/capsule").CapsuleConfig & { trip?: { destination: string; start: string; days: number; climate: string } };
  itemIds: string[];
  days: import("./style/capsule").Day[];
  packed: Record<string, boolean>;
  createdAt: string;
};
