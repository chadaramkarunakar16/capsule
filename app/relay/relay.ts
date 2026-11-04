// Stateless relay for the hosted build. The browser engine calls other websites through it because those sites
// don't allow cross-origin requests. It stores nothing and logs nothing; API keys pass through in headers.
// Runs unchanged as a Next route (local) and as a Cloudflare Pages Function (hosted).

const KEYED = new Set(["generativelanguage.googleapis.com", "api.openai.com", "serpapi.com"]);
const PASS_REQ = /^(content-type|accept|authorization|x-api-key|x-goog-api-key|anthropic-version|anthropic-beta|user-agent)$/i;
const PASS_RES = /^(content-type|content-length|location|cache-control)$/i;
const MAX_BYTES = 15 * 1024 * 1024;

function blockedHost(h: string) {
  const x = h.toLowerCase();
  return (
    x === "localhost" || x.endsWith(".localhost") || x.endsWith(".local") || x.endsWith(".internal") || x.endsWith(".home.arpa") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(x) || x.includes(":") || x.startsWith("[") || !x.includes(".")
  );
}

const json = (error: string, status: number) => new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json" } });

export async function relay(req: Request, opts: { origin: string; allowPrivate?: boolean }): Promise<Response> {
  if (req.headers.get("sec-fetch-site") === "cross-site" || (req.headers.get("origin") && req.headers.get("origin") !== opts.origin)) return json("not allowed", 403);
  const raw = req.headers.get("x-proxy-url");
  if (!raw) return json("missing x-proxy-url", 400);
  let target: URL;
  try { target = new URL(raw); } catch { return json("bad url", 400); }
  if (target.protocol !== "https:" && !(opts.allowPrivate && target.protocol === "http:")) return json("only https links are supported", 400);
  const keyed = KEYED.has(target.hostname);
  if (!opts.allowPrivate && blockedHost(target.hostname)) return json("That address isn’t allowed", 400);
  if (!keyed && req.method !== "GET") return json("only GET is allowed for this host", 405);

  const headers = new Headers();
  req.headers.forEach((v, k) => { if (PASS_REQ.test(k)) headers.set(k, v); });
  let up: Response;
  try {
    up = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
      redirect: "manual",
      // @ts-expect-error duplex is needed for streamed request bodies on some runtimes
      duplex: "half",
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    return json("Couldn’t reach that site", 502);
  }
  const len = Number(up.headers.get("content-length") || 0);
  if (len > MAX_BYTES) return json("That file is too large", 413);
  const out = new Headers();
  up.headers.forEach((v, k) => { if (PASS_RES.test(k)) out.set(k, v); });
  // Redirects are handed back as data so the engine can re-check each hop itself.
  out.set("x-proxy-status", String(up.status));
  out.set("cache-control", "no-store");
  return new Response(up.body, { status: 200, headers: out });
}
