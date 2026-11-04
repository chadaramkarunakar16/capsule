// Cloudflare Pages Function: the stateless relay (see relay/relay.ts). Handles every method on /proxy.
// The Android app runs from its own origin, so those origins are allowed to call it (with CORS).
import { relay } from "../relay/relay";

const NATIVE = ["https://localhost", "capacitor://localhost", "http://localhost"];

export const onRequest = async (ctx: { request: Request }) => {
  const req = ctx.request;
  const own = new URL(req.url).origin;
  const origin = req.headers.get("origin");
  const native = origin && NATIVE.includes(origin) ? origin : null;
  const cors = native
    ? { "access-control-allow-origin": native, "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-expose-headers": "x-proxy-status,location", vary: "origin" }
    : ({} as Record<string, string>);
  if (req.method === "OPTIONS") return new Response(null, { status: native ? 204 : 403, headers: cors });
  const res = await relay(req, { origin: native ?? own });
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
  return out;
};
