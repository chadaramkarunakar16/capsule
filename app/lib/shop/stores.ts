// Where to search. These are plain search-result links the user opens themselves — no scraping, no affiliate tags.

export type Country = { code: string; name: string; gl: string; currency: string; symbol: string };

export const COUNTRIES: Country[] = [
  { code: "IN", name: "India", gl: "in", currency: "INR", symbol: "₹" },
  { code: "US", name: "United States", gl: "us", currency: "USD", symbol: "$" },
  { code: "GB", name: "United Kingdom", gl: "uk", currency: "GBP", symbol: "£" },
  { code: "CA", name: "Canada", gl: "ca", currency: "CAD", symbol: "$" },
  { code: "AU", name: "Australia", gl: "au", currency: "AUD", symbol: "$" },
  { code: "AE", name: "United Arab Emirates", gl: "ae", currency: "AED", symbol: "AED" },
  { code: "DE", name: "Germany", gl: "de", currency: "EUR", symbol: "€" },
  { code: "FR", name: "France", gl: "fr", currency: "EUR", symbol: "€" },
];
export const country = (code?: string | null) => COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];

export type StoreLink = { name: string; url: string };

const q = encodeURIComponent;
const dashed = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function searchLinks(query: string, code: string): StoreLink[] {
  const c = country(code);
  const g: StoreLink = { name: "Google Shopping", url: `https://www.google.com/search?tbm=shop&q=${q(query)}&gl=${c.gl === "uk" ? "gb" : c.gl}` };
  switch (c.code) {
    case "IN":
      return [g,
        { name: "Myntra", url: `https://www.myntra.com/${dashed(query)}` },
        { name: "Ajio", url: `https://www.ajio.com/search/?text=${q(query)}` },
        { name: "Amazon.in", url: `https://www.amazon.in/s?k=${q(query)}` },
        { name: "Flipkart", url: `https://www.flipkart.com/search?q=${q(query)}` },
        { name: "Nykaa Fashion", url: `https://www.nykaafashion.com/catalogsearch/result/?q=${q(query)}` },
        { name: "H&M", url: `https://www2.hm.com/en_in/search-results.html?q=${q(query)}` },
        { name: "Zara", url: `https://www.zara.com/in/en/search?searchTerm=${q(query)}` }];
    case "GB":
      return [g,
        { name: "ASOS", url: `https://www.asos.com/search/?q=${q(query)}` },
        { name: "Amazon.co.uk", url: `https://www.amazon.co.uk/s?k=${q(query)}` },
        { name: "M&S", url: `https://www.marksandspencer.com/search?q=${q(query)}` },
        { name: "H&M", url: `https://www2.hm.com/en_gb/search-results.html?q=${q(query)}` },
        { name: "Zara", url: `https://www.zara.com/uk/en/search?searchTerm=${q(query)}` }];
    case "US":
    case "CA":
    case "AU":
    case "AE":
    case "DE":
    case "FR":
    default:
      return [g,
        { name: "ASOS", url: `https://www.asos.com/us/search/?q=${q(query)}` },
        { name: "Amazon", url: `https://www.amazon.com/s?k=${q(query)}` },
        { name: "Nordstrom", url: `https://www.nordstrom.com/sr?keyword=${q(query)}` },
        { name: "H&M", url: `https://www2.hm.com/en_us/search-results.html?q=${q(query)}` },
        { name: "Zara", url: `https://www.zara.com/us/en/search?searchTerm=${q(query)}` }];
  }
}

/** Stores worth treating as established (big, with real return policies). Matched against the merchant name or host. */
export const ESTABLISHED = [
  "amazon", "myntra", "ajio", "flipkart", "nykaa", "tata cliq", "tatacliq", "asos", "zara", "h&m", "hm.com", "uniqlo", "nike", "adidas", "puma",
  "levi", "marks & spencer", "marksandspencer", "m&s", "nordstrom", "macy", "target", "walmart", "john lewis", "next", "gap", "banana republic", "j.crew",
  "mango", "cos", "arket", "& other stories", "decathlon", "bata", "woodland", "fabindia", "westside", "pantaloons", "shoppers stop", "lifestyle", "max fashion",
  "reliance trends", "jockey", "allen solly", "van heusen", "peter england", "louis philippe", "raymond", "w for woman", "biba", "ralph lauren", "tommy hilfiger",
  "calvin klein", "ugg", "new balance", "converse", "vans", "reebok", "skechers", "clarks", "zalando", "farfetch", "net-a-porter", "mytheresa", "ssense",
];
export const MARKETPLACES = ["ebay", "aliexpress", "alibaba", "temu", "etsy", "dhgate", "wish", "shein", "meesho", "olx", "poshmark", "depop", "vinted", "mercari", "snapdeal", "indiamart"];
