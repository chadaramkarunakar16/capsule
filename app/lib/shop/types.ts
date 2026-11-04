export type Piece = {
  id: string;
  name: string;               // "Olive overshirt"
  category: string;           // Tops | Bottoms | Dresses | Outerwear | Shoes | Bags | Accessories
  colorName: string;
  colorHex: string;
  pattern: string;
  fit: string;
  material?: string;
  /** what to type into a store search, e.g. "olive green oversized cotton overshirt men" */
  query: string;
  brand?: string;
  formality?: number;
  /** user chose to look for one even though they own something close */
  forceShop?: boolean;
  /** what you want to do with this piece from an inspiration look: still to buy (the default), got it, or not interested */
  want?: "tobuy" | "got" | "skip";
};

export type Look = {
  id: string;
  image: string;
  sourceUrl: string;
  note: string;
  pieces: Piece[];
  analysed: boolean;
  createdAt: string;
};

export type Trust = {
  level: "established" | "marketplace" | "unknown" | "caution";
  label: string;
  notes: string[];
};

export type ProductSource = "serpapi" | "pasted";

export type Product = {
  id: string;
  lookId: string | null;
  pieceId: string | null;
  title: string;
  merchant: string;
  url: string;
  imageUrl: string;
  price: number | null;
  oldPrice: number | null;
  currency: string;          // symbol or code as shown, e.g. "₹"
  rating: number | null;
  reviews: number | null;
  delivery: string;
  source: ProductSource;
  trust: Trust;
  selected: boolean;
  saved: boolean;
  firstPrice: number | null;
  createdAt: string;
  updatedAt: string;
};

/** A search result before it is saved. */
export type Candidate = Omit<Product, "id" | "lookId" | "pieceId" | "selected" | "saved" | "firstPrice" | "createdAt" | "updatedAt">;

export type Ranked = Candidate & {
  relevance: number;                  // 0..1
  tier: "best" | "similar" | "budget";
  colourMatch: boolean;
  palette: { delta: number; text: string | null };
  unlocks: number;                    // good outfits this would add
};
