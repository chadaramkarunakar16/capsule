# Capsule — Phases 1–6 (local web app)

Closet, outfits, boards and a wear calendar. Everything is stored on your machine.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Needs Node 22.5+ (uses the built-in `node:sqlite`). Data lives in `data/` (git-ignored):
`data/capsule.db` and `data/uploads/`.

## AI tagging (optional)

Without a key, Capsule guesses colour and category on-device and you fix the rest in the review queue.
With a key, Claude reads each photo and fills in name, category, colour, fit, pattern, formality, season.

Set the key in the app (**Me → AI tagging**) or via the environment:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

Model defaults to `claude-haiku-5-5`; override with `CAPSULE_TAG_MODEL`.

## What's in Phase 1

- **Add photos** (+): bulk upload → on-device background removal (`@imgly/background-removal`, model downloads on first use) → tagging → review queue (duplicate hints) → closet.
- **Closet**: search, category filter, sort, item detail (edit everything, price, cost-per-wear, wears), delete.
- **Outfits**: manual builder, save, "wore it today".
- **Boards**: Pinterest-style masonry; save closet items, outfits, or inspiration images with a note and source link.
- **Today**: week strip, month calendar of what you wore, streak, log by outfit or by pieces.
- **Capsule**: analytics (value, avg cost/wear, most worn, never worn, category mix).
- **Me**: export everything to one JSON file, import it back (replaces library).

## Layout

- `lib/db.ts` — SQLite schema and helpers · `lib/queries.ts` — shared queries
- `app/api/*` — route handlers (items, outfits, wears, boards, upload, tag, export, import, settings, img)
- `lib/image.ts` — browser-side image helpers · `app/_ui/*` — screens

## Phase 2 — style profile

**Me → Your style profile** walks through four short steps (all optional, all editable):

- **About you**: height, optional weight (kept for the avatar later, never used to score clothes), fit preference, what you want clothes to do.
- **Proportions**: tape measurements, a full-body photo (MediaPipe pose, on-device), or just describe yourself. Neutral wording only.
- **Colour**: up to 3 face photos (skin, hair and eye colour sampled on-device) plus a 6-question quiz → one of 12 seasons with a confidence score, runner-up seasons, and a manual override. Disagreeing photos lower the confidence.
- **Face shape**: from a photo (MediaPipe face mesh) or pick it yourself.

Photos are analysed in the browser and **never uploaded or stored**; only the derived numbers and choices are saved (`profile` table).
First use downloads two small MediaPipe models (face ≈ 4 MB, pose ≈ 6 MB) from Google's public model bucket via `/api/model/*`; they're cached in `data/models/` afterwards.

Where it shows up: a **"How it suits you"** card with reasons on every item, a live score on the outfit builder (occasion changes the dressiness target), ★ badges and a "Suits you" sort in the closet, and **Me → My palette**.
Neckline, rise and length (item page) sharpen the advice; AI tagging fills them in automatically.

The rules live in `lib/style/*` (pure TypeScript, no DOM) and are covered by `npm test`.

## Phase 2B — your closet stylist

**Today → Style me** builds outfits from clothes you own only, ranked by how well they suit *you* (Phase 2 profile) and explained in plain language.

- Ask in your own words: *"Dinner date, a bit dressy"*, *"cold and rainy brunch"*, *"something with my olive jacket"*, *"rediscover things I rarely wear"*. Occasion sets the dressiness target; weather words set the temperature; naming a piece anchors the look around it.
- **Weather (opt-in):** tap "Add weather", use your location or search a city. Capsule layers up when it's cold or rainy and skips the coat when it's warm. Only the coordinates you choose go to Open-Meteo; nothing else leaves your computer.
- **Rotation:** what you wore in the last few days is nudged down; "rediscover" nudges rarely-worn pieces up.
- **Learning:** ♡ and 👎 (with reasons like "Don't like this pairing") teach it your taste. Review or reset it under Me → What Capsule has learned.
- **Customize:** dark swipe-row editor — swipe outerwear / tops / bottoms / shoes / bags; the score and reasons update live and each tile shows the score you'd get by choosing it.
- **Wear today / Plan… / Save:** log it, plan it for one of the next 7 days (shows as a dashed day on the calendar; "I wore this" confirms it), or save it to Outfits. Planned looks don't count as wears until confirmed.
- **Capsule tab:** *Rediscover* (new ways to wear rarely-worn pieces) and *Closet review* (keep / try styling differently / consider passing on — a gentle nudge, never deletes anything).
- **Outfit photo** (+ → Outfit photo): a mirror selfie is split into its pieces; each is cropped, cut out and saved as a draft. Needs an Anthropic key.

The generator is `lib/style/generate.ts` (beam search over top × bottom × shoes × layer × bag, pure TypeScript, covered by `npm test`).

## Phase 3 — shop the look

**+ → Shop a look** (or Closet → Shop, or a board image → "Find these pieces", or **Share → Capsule** once installed as an app).

1. Add a screenshot of an outfit you love. With an Anthropic key Capsule lists the pieces automatically; without one you add them yourself (name, colour, fit) in a few taps.
2. **Do I already own it?** Each piece is compared with your closet. Close matches show "You already own this" — you can still choose to shop for one.
3. **Find the rest.** Every piece gets store-search links for your country (Myntra, Ajio, Amazon, Flipkart, ASOS, Zara… — plain links, no tracking, no affiliate tags). Paste any product link and Capsule reads the price and rating the page itself publishes (schema.org / Open Graph).
4. **Live results (optional):** add a SerpApi key under **Me → Shopping** to pull Google Shopping results — price, rating, review count, store. Results are ranked by how well the title matches, colour, rating, and how well the colour suits you, and tagged *Best match* / *Budget pick*, *In your palette*, and *+N outfits* (good outfits it would add to what you own).
5. **Trust flag** on every store: established retailer, marketplace seller, unverified store, or "be careful" (non-https, or a price far below similar items). It's a prompt to do homework, not a fake detector. Flagged stores always sink to the bottom.
6. **Choose** one product per piece for a running total, **♡** to save to your wishlist, ↻ to re-read a saved link's price (price history and "↓ x% since saved").

Notes: reviews are shown only as the rating and count that the source publishes. Exact-item visual search isn't available without a paid provider, so results are "best match" / "similar", never "exact". Set your region under Me → Shopping.
Env vars: `SERPAPI_KEY`, `CAPSULE_COUNTRY` (e.g. `IN`).

## Phase 4 — capsules, trips and gaps

**Capsule tab → Plans**
- **Plan a trip:** destination, start date, number of days, weather (or the real forecast for the next 7 days if you've turned weather on). Capsule picks the few pieces that make the most good outfits together, then plans a look for every day — repeating tops as little as possible — using only those pieces. Tap a day's tag (Casual / Smart / Dressy) to re-plan it, ↻ Another for the next-best look, or Customize. **Packing** is a checklist (progress saved); **Add these looks to my calendar** creates planned looks that show on Today on the day.
- **Work week, Minimal wardrobe (≈30 pieces), Everyday, Custom size:** the same engine without dates. Pin pieces you must keep ("Always keep this"), leave pieces out, or rebuild.
- Each plan shows the number of good outfits it makes and how many per piece.

**Capsule tab → Insights**
- **Coverage:** how many good outfits your closet can make for casual, smart, dressy, cold, mild and hot — with what would help where it's thin.
- **One piece, more outfits:** purchases that would add the most good outfits to what you own, in colours that suit you. New tops/bottoms are counted as *new outfits*; layers/shoes as *looks it fits* (weighted lower, since they extend existing outfits). **Find it** opens the shopping search for that piece (Phase 3) — save it to your wishlist.
- **Doubles:** near-identical pieces, with the one you reach for most outlined. Nothing is ever deleted for you.

How it works: `lib/style/capsule.ts` — greedy selection with swap refinement over pair-compatibility tables, quotas per goal, and a colour-cohesion penalty; day planning via the Phase 2B generator with usage penalties (pure TypeScript, covered by `npm test`).

## Phase 5 — avatar and try-on

**Avatar (no account needed).** *Me → My avatar* is a simple front-facing figure built from your profile: shoulder/hip balance, torso/leg proportion, waist, your measurements if you entered them, and height. Weight gives the Build slider a starting point (BMI-based) that you can move freely — it never affects clothing scores. Skin tone and hair start from your colour photos if you did that step; change them any time. Sliders fine-tune shoulders, waist, hips and leg length.

**On me.** An *On me* button appears on a suggested look, in Customize, and in the outfit builder. Your photos of each piece are placed on the figure in the right layer order (a dress replaces top and bottom), sized to your proportions — good for judging silhouette, colour and balance. Take pieces off or add others, load a saved outfit, or save the look. It is labelled *Preview — approximate*: drape and fabric aren't modelled.

**Side by side.** In a trip or capsule, *See them on my avatar* lines up every day's look.

**On my photo (optional, paid).** Add a FASHN key under *Me → Photo try-on*. Upload a full-body photo and Capsule puts your tops, bottoms or dress on *you* (pieces are applied one after another). Needs an explicit consent tick; your photo is sent to FASHN only when you press the button and is never stored here — only the result image is kept (and can be saved to a board). Outerwear, shoes and bags aren't supported by this model yet. Env var: `FASHN_API_KEY`.

Not built: a 3D avatar (Phase 5c) — see the plan.

## Phase 6 — hair, facial hair and glasses

**Me → Hair, beard & glasses.** Suggestions are matched to your face shape (Phase 2) plus a few things only you know: hair type (straight / wavy / curly / coily), density, whether your hairline is receding, current length, and how much effort you want to put in. Facial-hair ideas are opt-in, matched to your face shape and how your growth is (patchy or full).

- **Hair:** 22 unisex styles from buzz cuts to locs and braids, each with a match %, plain reasons ("Height on top lengthens a round face"), cautions ("needs fuller hair", "about 8 months to grow"), upkeep (time between cuts) and day-to-day tips.
- **Facial hair:** clean-shaven, stubble, short boxed, full, goatee, Van Dyke, circle, chin strap.
- **Glasses:** 11 frame shapes by face shape, nudged by your colouring (bolder frames for high-contrast colouring, lighter for soft), plus frame **colours for your season** (warm tortoise/olive/gold vs black/navy/silver, etc.). *Find frames to buy* uses the shopping search from Phase 3.
- **Illustrations:** every card is drawn on your face shape, skin tone and hair colour (change the hair colour in the style's detail page to preview). They're illustrations, not photos — labelled approximate.
- **Take this to your stylist/barber:** a plain-language card — what to ask for (clipper guards, lengths, neckline), your hair details, how often to trim, styling tips. *Copy* or *Share* it, and attach a reference photo of the look you want.
- **Frames on my photo:** upload a front-facing photo and frames are drawn on it using face landmarks (size, up/down, colour, 11 shapes); save the image or put it on a board. Runs entirely in the browser; the photo is never uploaded. (There is no generative hair-preview: that needs a paid image model and often looks unrealistic.)

All of this is guidance, not rules — a good stylist adapts it to your hair in person.

## Windows app (the main way to use Capsule)

Capsule installs like normal PC software: a window with a sidebar, a Desktop and Start Menu shortcut with the Capsule logo, and **all data on your PC** in `%APPDATA%\Capsule\data` (database + photos; *Capsule menu → Open my data folder*). Nothing is uploaded unless you use an AI feature with your own key.

- **Install:** run `dist\Capsule Setup 0.1.0.exe` (per-user, no admin; add `/S` for a silent install). Uninstalling keeps your data.
- **Rebuild it:** `npm run desktop:dist` (installer) or `npm run desktop:pack` (unpacked folder). `npm run desktop` opens it straight from source after `npm run desktop:build`.
- **How it works:** `desktop/main.cjs` (Electron) starts the same Next.js server privately on `127.0.0.1:47621` and shows it in a window. Wide windows get the desktop layout (sidebar, dialogs, multi-column grids); narrow ones fall back to the phone layout.
- **Not signed:** Windows SmartScreen may warn on first run of an unsigned installer (More info → Run anyway). Signing needs a paid certificate.

### Avatar, photos and keys
- **My avatar and face** (Me tab): the live avatar sits beside the controls, so every change is visible as you make it. Add a face photo and a full-body photo; they fill in face shape, skin tone, hair colour, a first colour estimate and your proportions, shared with the style-profile questions (they read and write the same data).
- **How I appear:** choose the simple figure, your own photo (kept on your PC only if you press "Use as my avatar"), or an AI image made from your photos by a Gemini image model. With a photo avatar, "On my photo" try-on starts from your saved photo.
- **API keys are never shown.** Not even the last characters: a saved key appears as "saved · hidden" with **Edit key** and **Remove** (Me → AI, Your stylist, and Privacy & data).
- **Offline cut-outs:** the background-removal model is downloaded into `public/imgly` by `npm run dev/build` (and the desktop build), so adding photos works offline and starts instantly.

### Stylist knowledge layer
`lib/knowledge/` holds Capsule's styling knowledge in one place: what hairstyles, beards, glasses and sunglasses suit each face shape; how a lean, average or fuller build, and a shorter or taller height, change what to wear (lean frames get layering, textured mid-weight fabrics and shoulder structure; fuller frames get tonal lines and structured mid-weight pieces); colour and skin-tone guidance; and healthy grooming basics. It was cross-checked against published eyewear and men's/women's style guides. It is used twice: the outfit scoring (`lib/style/score.ts`) and the grooming engine apply the same rules, and `brief()` turns the parts that apply to *you* into a short briefing that the AI reads **before** it answers (Me → Your stylist). The AI may only choose styles that exist in Capsule and closet pieces you own, so every suggestion can be opened and acted on. If you keep a face photo, the stylist can also look at it (sent to Google only when you ask).

### AI (your own Gemini key)
Me → AI: paste a Gemini API key. Features pick the cheapest model that does the job (prices per 1M tokens, input / output; photo try-on per image):

| Feature | Economy (default) | Better |
|---|---|---|
| Piece details from one photo | `gemini-3.1-flash-lite` (0.25 / 1.50) | `gemini-3.5-flash-lite` (0.30 / 2.50) |
| Splitting an outfit photo, reading inspiration looks | `gemini-3.5-flash-lite` | `gemini-3.6-flash` (0.75 / 3.75) |
| Stylist advice | `gemini-3.5-flash-lite` | `gemini-3.6-flash` |
| Photo try-on | `gemini-2.5-flash-image` (~$0.039 per image) | `gemini-3.1-flash-image` (~$0.067 per image) |

Thinking is set to minimal, photos are shrunk before sending (768 px for single pieces, 1280 px otherwise) and single-garment photos use the lowest image detail. The settings card shows this month's call count. FASHN remains an optional alternative for try-on. Prices come from Google's pricing page as of Nov 2026 and change; the Gemini calls were tested against a mock server, not a live key.

## Other ways to run it

1. **Local (Node server)** — `npm run dev`. Data in `app/data/` (SQLite + photos). Optional PIN, `npm run lan` for your phone.
2. **Hosted PWA (Cloudflare Pages)** — local-first: the whole "server" runs inside the browser.
   - `engine/` bundles Capsule's own API routes into a worker (`public/engine/worker.js`) running **SQLite-wasm in the browser's private file system** (OPFS). Photos are stored in the same database, so one file holds everything. `lib/api.ts` talks to it instead of the network (`NEXT_PUBLIC_ENGINE=browser`).
   - The only server code is `functions/proxy.ts` (`relay/relay.ts`): a stateless relay for calls other sites block from browsers (shopping search, Anthropic, FASHN, merchant pages). It stores and logs nothing, only forwards, refuses private/local addresses, accepts GET only for ordinary sites, and rejects cross-site callers. Your API keys live in your browser and pass through it per request.
   - Try it: `npm run dev:browser` (localhost:3000, browser engine), or `npm run build:static` then `npm run preview:static` (Cloudflare's own runtime locally).
   - Deploy: `npx wrangler login` once, then `npm run deploy` (or connect the repo to Cloudflare Pages with build command `npm run build:static` and output directory `out`).
   - Data stays on that device and browser; it does not sync. Use *Privacy & data → encrypted backup* to move it. One window at a time may open the library.
3. **Android app** — wrap the static build with Capacitor, see [android/README.md](android/README.md).

## Phase 7 — privacy, offline, Android

- **PIN lock (optional):** Me → Privacy & data → set a 4–12 digit PIN. Stored as a scrypt hash; sessions are signed cookies (30 days); 5 wrong tries lock the login for 5 minutes; changing or removing the PIN signs everyone out.
- **Local only by default:** `npm run dev` / `npm start` bind to 127.0.0.1. `npm run lan` exposes the app on your Wi-Fi (for a phone) and refuses to start without a PIN; the proxy also blocks all requests in LAN mode when no PIN is set.
- **Privacy & data screen:** exactly what is stored (rows, photos, models, which API keys exist), what can leave the device (only when you use a keyed feature, listed per feature), encrypted backup/restore (AES-256-GCM, key from your passphrase via PBKDF2-SHA256, 250k rounds — **a forgotten passphrase cannot be recovered**) and *Delete everything* (type `DELETE EVERYTHING`).
- **Speed:** pictures are served as cached WebP thumbnails (`/api/img/<name>?w=160|320|640`; a 207 KB photo became 4.5 KB).
- **Offline:** `public/sw.js` (production builds only) caches pictures and built assets and falls back to the last page copy; data calls are always live. Nothing is cached when a PIN is set, and *Delete everything* clears the cache.
- **Accessibility:** focus rings, reduced-motion support, dialogs have roles, Esc closes the top-most sheet/overlay.
- **Error pages:** friendly `error`, `global-error`, `not-found`.
- **Android:** see [android/README.md](android/README.md).
- **Legal drafts:** [docs/PRIVACY.md](docs/PRIVACY.md).

### Honest limits
Not built: cloud sync/accounts, push notifications, dark mode, a 3D avatar. The service worker, the Cloudflare deployment itself and the Android wrapper were not verified in a real browser/device in this session (the in-app browser pane refuses service workers).

## Not yet (see ../CAPSULE_PLAN.md)

 cloud sync, push notifications, dark mode, 3D avatar.

Currency is shown as ₹ for now.
