// The "server" that runs inside your browser: Capsule's own API routes, answered from local SQLite.
import { Buffer } from "buffer";
import { ROUTES } from "./routes.gen";
import { persistent, storageError } from "./sqlite";

(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;

// Calls to other websites (shopping search, AI, try-on, merchant pages) go through the stateless relay.
const realFetch = globalThis.fetch.bind(globalThis);
// Set by the page for native shells (their own origin has no relay): the hosted site's /proxy.
const RELAY = new URLSearchParams(self.location.search).get("relay") || "/proxy";
const DIRECT = [self.location.origin, "https://storage.googleapis.com"];
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!/^https?:/i.test(url) || DIRECT.some((d) => url.startsWith(d))) return realFetch(input, init);
  const headers = new Headers(init?.headers);
  headers.set("x-proxy-url", url);
  return realFetch(RELAY, { method: init?.method ?? "GET", headers, body: init?.body, signal: init?.signal }).then((r) => {
    const status = Number(r.headers.get("x-proxy-status") || r.status);
    const h = new Headers(r.headers);
    return new Response(r.body, { status: status >= 200 && status <= 599 ? status : r.status, headers: h });
  });
};

type Match = { mod: Record<string, (r: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>>; params: Record<string, string> };
const table = ROUTES.map((r) => ({ ...r, segs: r.pattern.split("/").filter(Boolean) })).sort(
  (a, b) => a.segs.filter((s) => s.startsWith("[")).length - b.segs.filter((s) => s.startsWith("[")).length,
);
function match(path: string): Match | null {
  const parts = path.split("/").filter(Boolean);
  for (const r of table) {
    if (r.segs.length !== parts.length) continue;
    const params: Record<string, string> = {};
    if (r.segs.every((s, i) => (s.startsWith("[") ? ((params[s.slice(1, -1)] = decodeURIComponent(parts[i])), true) : s === parts[i]))) return { mod: r.mod as Match["mod"], params };
  }
  return null;
}

async function handle(m: { method: string; url: string; headers: [string, string][]; body: ArrayBuffer | null }) {
  const u = new URL(m.url, self.location.origin);
  const hit = match(u.pathname);
  if (!hit) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  const fn = hit.mod[m.method];
  if (!fn) return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  const hasBody = m.body && m.method !== "GET" && m.method !== "HEAD";
  const req = new Request(u, { method: m.method, headers: m.headers, body: hasBody ? m.body : undefined });
  try {
    return await fn(req, { params: Promise.resolve(hit.params) });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "engine error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

type Port = { postMessage(m: unknown, t?: Transferable[]): void; onmessage: ((e: MessageEvent) => void) | null; start?: () => void };
function serve(port: Port) {
  port.onmessage = async (ev: MessageEvent) => {
    const { id, ...m } = ev.data;
    try {
      const res = await handle(m);
      const body = await res.arrayBuffer();
      port.postMessage({ id, status: res.status, headers: [...res.headers.entries()], body }, [body]);
    } catch (e) {
      const body = new TextEncoder().encode(JSON.stringify({ error: e instanceof Error ? e.message : "engine error" })).buffer;
      port.postMessage({ id, status: 500, headers: [["content-type", "application/json"]], body }, [body]);
    }
  };
  port.start?.();
  port.postMessage({ ready: true, persistent, storageError });
}
// One engine per browser profile: the storage layer refuses to open twice, so a second window gets a clear message instead of a second copy of your data.
serve(self as unknown as Port);
