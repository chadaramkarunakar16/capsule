// Capsule service worker: keeps the app shell and your own pictures available offline.
// Responses carrying x-capsule-pin (PIN-protected data) are never stored.
const V = "capsule-v1";
const IMG = /^\/api\/img\//;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => {
  if (e.data === "wipe") e.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))));
});

async function put(req, res) {
  if (!res.ok || res.headers.get("x-capsule-pin")) return;
  (await caches.open(V)).put(req, res.clone());
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method === "POST" && url.pathname === "/share" && url.origin === location.origin) { e.respondWith(handleShare(req)); return; }
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/") && !IMG.test(url.pathname)) return; // data always comes live

  // Pictures and built assets never change under the same URL: cache first.
  if (IMG.test(url.pathname) || url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/mediapipe/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { put(req, res); return res; })));
    return;
  }
  // Pages: network first, fall back to the last copy when offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => { put(req, res); return res; }).catch(() => caches.match(req).then((hit) => hit || caches.match("/"))));
  }
});

// "Share → Capsule". With a server (local build) the server handles it; on static hosting there is none,
// so keep the shared picture here and let the page pick it up and store it in the on-device library.
async function handleShare(req) {
  const copy = req.clone();
  try {
    const r = await fetch(req);
    if (r.ok || r.redirected) return r;
  } catch { /* offline or no server */ }
  const form = await copy.formData().catch(() => null);
  const f = form && form.get("image");
  const link = ((form && String(form.get("url") || form.get("text") || "")) || "").match(/https?:\/\/\S+/);
  const c = await caches.open("capsule-share");
  await c.put("/__share/meta", new Response(JSON.stringify({ link: link ? link[0] : "", title: (form && String(form.get("title") || "")) || "" })));
  if (f && typeof f !== "string") await c.put("/__share/image", new Response(f, { headers: { "content-type": f.type } }));
  else await c.delete("/__share/image");
  return Response.redirect("/?shared=1", 303);
}
