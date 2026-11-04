"use client";
// Client side of the in-browser engine: sends API calls to the worker that holds your SQLite library.
// Enabled with NEXT_PUBLIC_ENGINE=browser (the hosted/PWA build); the local build talks to the Node server instead.

export const BROWSER_ENGINE = process.env.NEXT_PUBLIC_ENGINE === "browser";

type Reply = { id: number; status: number; headers: [string, string][]; body: ArrayBuffer };
type Port = { postMessage(m: unknown, t?: Transferable[]): void; onmessage: ((e: MessageEvent) => void) | null; start?: () => void };
let port: Port | null = null;
let ready: Promise<void> | null = null;
let seq = 0;
const waiting = new Map<number, (r: Reply) => void>();
export const engineStatus: { persistent: boolean; error: string } = { persistent: true, error: "" };

function start() {
  if (ready) return ready;
  ready = new Promise<void>((resolve, reject) => {
    const relay = process.env.NEXT_PUBLIC_RELAY_URL;
    const url = "/engine/worker.js" + (relay ? `?relay=${encodeURIComponent(relay)}` : "");
    const w = new Worker(url, { type: "module" });
    port = w as unknown as Port;
    port.onmessage = (ev: MessageEvent) => {
      if (ev.data.ready) { engineStatus.persistent = !!ev.data.persistent; engineStatus.error = ev.data.storageError || ""; return resolve(); }
      waiting.get(ev.data.id)?.(ev.data);
      waiting.delete(ev.data.id);
    };
    port.start?.();
    w.onerror = (e: ErrorEvent) => { ready = null; reject(new Error(e.message || "The local engine failed to start")); };
  });
  return ready;
}

/** Same signature as fetch(), answered by the engine. */
export async function engineFetch(url: string, init?: RequestInit): Promise<Response> {
  await start();
  const rq = new Request(new URL(url, location.origin), init);
  const body = ["GET", "HEAD"].includes(rq.method) ? null : await rq.arrayBuffer();
  const id = ++seq;
  const reply = new Promise<Reply>((res) => waiting.set(id, res));
  port!.postMessage({ id, method: rq.method, url: rq.url, headers: [...rq.headers.entries()], body }, body ? [body] : []);
  const r = await reply;
  return new Response(r.body, { status: r.status, headers: r.headers });
}

export const apiFetch: typeof fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  BROWSER_ENGINE ? engineFetch(typeof input === "string" ? input : input.toString(), init) : fetch(input, init)) as typeof fetch;

/* ------- pictures: the engine serves them as bytes, so hand the page object URLs ------- */

const urls = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
const listeners = new Set<() => void>();
let version = 0;
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

export const subscribeImages = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const imageVersion = () => version;

/** Resolves to a displayable URL for an uploaded picture. */
export function imageUrl(path: string): Promise<string> {
  if (!BROWSER_ENGINE) return Promise.resolve(path);
  const hit = urls.get(path);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(path);
  if (!p) {
    p = engineFetch(path)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("missing picture"))))
      .then((b) => {
        const u = URL.createObjectURL(b);
        urls.set(path, u);
        version++;
        listeners.forEach((l) => l());
        return u;
      })
      .finally(() => pending.delete(path));
    pending.set(path, p);
  }
  return p;
}

/** Synchronous variant for JSX: the real URL once loaded, a blank pixel meanwhile (the page re-renders when it arrives). */
export function imageUrlSync(path: string): string {
  if (!BROWSER_ENGINE) return path;
  const hit = urls.get(path);
  if (hit) return hit;
  imageUrl(path).catch(() => {});
  return BLANK;
}

if (BROWSER_ENGINE && typeof window !== "undefined") (window as unknown as { __capsuleEngine: unknown }).__capsuleEngine = { fetch: engineFetch, status: engineStatus };
