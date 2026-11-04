# Capsule — Market Research & Phased Build Plan

*Researched 3 Nov 2026. Sources: app-store/Play listings, Reddit r/capsulewardrobe, Wirecutter, comparison blogs, GitHub. Claims from competitor-run blogs (Wdrobe, Tone & Fit, Wardrowbe, Nouva) are biased and are marked as such.*

---

## 1. One-line product

**Capsule: upload any outfit you love (Instagram/Pinterest screenshot) → Capsule finds the pieces, tells you what you already own, whether it suits *your* body/colouring, and where to buy the rest — then helps you build a small wardrobe that mixes and matches.** Unisex, fashion-first, grooming second.

---

## 2. Market landscape (what exists today)

### 2.1 Digital closet / AI stylist apps

| App | What it does well | What users dislike |
|---|---|---|
| **Alta (Alta Daily)** — free, iOS/Android/web, TIME Best Inventions 2025 mention | Free AI outfits (weather/calendar), avatar built from your photos with try-on, "Ask Alta" stylist chat, packing lists, community feed of looks, fast onboarding | Suggests clothes you *don't* own even in "closet" mode; pushes shopping (it earns affiliate cuts); avatar render limits (~20/day reported); no size tracking; clunky calendar; ignores some items, favours neutrals; white clothes vanish on white bg; "too much AI" for some. No colour-season or body-shape analysis listed (per a competitor's blog) |
| **Whering** — 10M+ users, 5M+ Android downloads, 4.4★ Play | Unlimited closet free, Chrome extension to digitise from shopping sites, moodboards, social, wear analytics | Bugs, slow loads, cropping tool problems, "too many features," no data export, try-on costs credits. Its planner suggestions are rule-based ("our own styling logic, not AI") |
| **Indyx** — free tier unlimited items, $12.99/mo | Receipt forwarding auto-adds items, cost-per-wear analytics, **human stylists** (lookbooks from $50), friends send you outfits; Wirecutter pick | No AI outfit generation; best bits are paywalled/human-priced |
| **Acloset** | AI tagging, daily picks | Moved to 100-item cap + ads/paywall (Reddit: "learned the hard way"); UI feels dated |
| **Stylebook** | Deepest manual control, $5 one-off | iOS only, no AI, poor backup (users lost whole closets) |
| **Cladwell** | Minimalist/capsule ethos, "see it on me" | Subscription; smaller |
| **Dressika / Tone & Fit / ColorMine / Style DNA** (colour analysis) | 12-season colour palette from a selfie, makeup & hair-colour try-on | **Inconsistent**: different photos → different seasons; lighting/screen distortion; Eurocentric bias complaints; paywalled results; some auto-edit photos badly |

### 2.2 "Shop the look from a picture"
- **Google Lens** (shopping results in ~35 countries incl. India), **Pinterest Lens/Shop**, **StyLens**, **Lykdat** all do image→similar products. They are *generic* — no knowledge of your wardrobe, body, colours, or budget, and they return near-matches, not "legitimate source with reviews."
- Product-data options for a developer: Google Shopping scrapers (SerpApi, DataForSEO, PrismCrawl — roughly $0.15–$1 per 1,000 searches), affiliate networks' product-search/feeds (Rakuten Advertising, etc.), Shopify's catalog search. Google's own Content API for Shopping is deprecated (→ Merchant API, which is for *merchants*, not shoppers).

### 2.3 Virtual try-on & avatars
- Open-source try-on: **IDM-VTON** (~5.2k★, SDXL, best fidelity but loses logos/text), **CatVTON** (~1.9k★, light), **OOTDiffusion** (~6.6k★, older, tops only), FASHN VTON v1.5 (pixel-space, no mask). **IDM-VTON, CatVTON, OOTDiffusion are CC BY-NC-SA 4.0 → non-commercial only.** Fine for your local prototype; a blocker (or a paid-API swap) if Capsule ever monetises. Source: FASHN comparison (FASHN sells a try-on API, so treat their rankings as interested).
- **Ready Player Me shut down 31 Jan 2026** (Netflix acquisition). Alternatives: MetaPerson/Avatar SDK, Avaturn (paid SDKs), Grab3D (modular, free creator). Don't depend on any hosted avatar vendor in the MVP.
- Alta's avatar is the benchmark users praise ("super accurate avatar") — but a generated figure ≠ "how it looks on my actual frame/face" (the gap Wdrobe, a competitor, is attacking by using your photo).

### 2.4 Open-source repos worth studying
- **Anyesh/wardrowbe** (MIT) — self-hosted wardrobe, AI tagging, weather/occasion outfit recs; good reference architecture.
- **wardrobe-hq/wardrobe**, **Libre Closet**, **OpenWardrobe** — simple cataloguers.
- **Zheng-Chong/Awesome-Try-On-Models**, **minar09/awesome-virtual-try-on** — curated try-on lists.
- Nothing open-source combines closet + shop-the-look + body/colour/face personalisation. That's the gap.

---

## 3. Where Capsule can win (gaps nobody fills well)

1. **Closet-aware shop-the-look.** Lens/Pinterest say "here are similar items." Capsule says "this look = 5 pieces; **you already own 2**, here are 3 to buy, in your colours, in your budget." Nobody does this end to end.
2. **Explained personalisation.** "Why this works on you" (colour season, proportions, face shape) — not a black box. Competitors either skip it or do colour analysis in isolation, inconsistently.
3. **Real capsule thinking.** Gap analysis — "adding one navy chino unlocks 11 new outfits" — and a pieces-vs-combinations score. Cladwell nods at it; the big apps are closet organisers.
4. **Menswear/unisex + grooming.** Most apps skew women's fashion. Hairstyle/beard/glasses by face shape is a real vertical (barbershop-style apps exist) but is rarely tied to the wardrobe.
5. **No-paywall-trap & data export.** Top complaints: item caps, sudden paywalls, lost data, no export. Make export (JSON/zip) a day-one feature.
6. **Android + web first.** Stylebook is iOS-only; several are iOS-first.

**Pain points to explicitly design against:** AI suggesting things you don't own · slow/buggy background removal · overwhelming feature sprawl · inconsistent colour results · aggressive shopping nudges · lost data.

---

## 4. Honest caveats (decide these early)

- **"Legitimate source + cost + reviews."** You can get price, rating and review *count* from shopping/affiliate APIs. **Scraping full review text from retailers violates their ToS** — show rating + count + link out, and optionally summarise reviews only where an API licenses it. "Legitimate" = authorised merchants via affiliate/product feeds, with a trust flag for unknown marketplaces and fakes/dupes.
- **Exact match is rare.** Image search finds exact items maybe for well-known brands; usually "closest 3–5 matches." UI must say "exact / close / budget alternative" honestly.
- **Colour season, face shape, body type are heuristics.** No app is reliably accurate (even a professional colour analyst says screens distort colour). Present as *suggestions with confidence + manual override*, never as verdicts. Color results must be re-run across 2–3 photos and require agreement.
- **Body analysis tone.** Not "ideal body types". Frame as "what flatters your proportions / what you want to emphasise." Let users pick goals ("look taller", "balance shoulders", "no preference"). Don't show BMI judgement language.
- **Privacy.** Full-body/face photos are sensitive biometric data. Local-first in the web prototype; opt-in cloud later; clear deletion; DPDP (India)/GDPR if you launch.
- **Licensing.** NC-licensed models are fine for personal prototyping, not for a paid product.

---

## 5. Recommended architecture (local web app → Android)

- **Frontend:** Next.js (React + TypeScript) + Tailwind, built as a **PWA**. Mobile-first UI from day one. Later wrap with **Capacitor** to ship an Android APK/AAB with the same code (fastest path; go React Native only if you hit camera/perf limits).
- **Backend:** Next.js API routes (Node) for CRUD + a small **Python FastAPI** service for ML jobs (segmentation, embeddings, try-on) — run both locally via `docker compose` or two terminals.
- **DB:** SQLite (local) via Drizzle/Prisma → Postgres later. Images on local disk (`/data/uploads`), S3-compatible later. Vector search: `sqlite-vec` or pgvector.
- **AI:**
  - **Claude (vision)** for: parsing an outfit image into garments (type, colour, fit, style), styling reasoning and "why it works" text. Use a fast model (Haiku 5.5) for tagging, Sonnet 5.5 for styling. Return structured JSON.
  - **Garment segmentation:** open clothes-parsing model (SegFormer-based clothes segmenter on Hugging Face) + background removal (e.g. rembg) — verify licences when you pick.
  - **Visual similarity:** fashion-tuned CLIP/SigLIP embeddings for "find similar" over your own product index.
  - **Face/pose:** **MediaPipe** Face Landmarker + Pose Landmarker — runs in-browser/on-device, free, good for privacy.
- **Product sourcing (layered):** (1) SerpApi/Google Shopping-style API for fast coverage in MVP; (2) affiliate networks/feeds for legit merchants + monetisation; (3) later, your own embedding index from feeds. Ask: which country/stores matter (India: Myntra/Ajio/Amazon.in/Flipkart via affiliate programmes; US/EU differ).
- **Avatar/try-on:** start with a **2D parametric figure** (SVG from height/weight/shape/proportions) — zero licensing risk. Then optional photo-based try-on (IDM-VTON/CatVTON locally; paid try-on API if commercial). 3D avatar last.
- **Cost guardrail:** cache everything (image hash → parse result → product results). Typical per-look cost target < $0.05.

### Core data model
`User profile` (height, weight, measurements, gender expression, goals, budget, country, colour season + confidence, face shape + confidence, body shape) · `Item` (photo, cut-out, category, colour, material, season, formality, price, brand, wear count) · `Outfit` (items, occasion, notes) · `Look` (inspiration image, parsed garments, matched products) · `Board` (like Pinterest: looks + items + products) · `Product` (merchant, url, price history, rating, review count, trust score) · `Capsule` (goal, pieces, coverage score).

---

## 5b. Design direction — inspired by Alta

*Based on altadaily.com, user write-ups, and the 8 Alta app screenshots you shared. Borrow the principles and patterns; use Capsule's own branding, icons, fonts and imagery — don't copy Alta's assets or the "ALTA" look-alike wordmark.*

**What Alta does well (borrow the principles, not the assets/branding):**
- **Calm, premium, low-energy aesthetic:** lots of white space, clean sans-serif (Helvetica-Neue-style grotesque), black/white with one blue accent, **fully rounded pill buttons**, ~16px card radius, minimal shadows. Photography-led; the clothes are the hero.
- **"Snap a photo → studio-quality image"**: every item becomes a clean cut-out on a neutral background. This single detail makes the whole closet feel curated.
- **Closet as a visual grid, outfit as a "virtual dressing room"**: avatar of you wearing the outfit + calendar of planned looks.
- **Goal-first onboarding**: "What's your style goal?" (plan better, look professional, expand wardrobe, evolve style, wear clothes more) — personalises immediately.
- Clear home tabs: **Daily outfits · Plan trips · Wishlist · Community/Inspiration**.
- Confidence-led, friendly copy ("Dress with confidence"), never body-shaming.

**Screen-by-screen notes from the Alta screenshots you shared (8 screens) and what Capsule does with each:**

| Alta screen | What it does | Capsule version |
|---|---|---|
| **Home / Today** | Greeting + weather (71°, H/L) top-right; named look ("Chic Brunch") with a `···` menu; the whole outfit shown as one full-height cut-out of the person on a light-grey stage; calendar icon left, help/bell/search right | Same structure. Add a one-line *why it suits you* under the look name, a "Suits you 86%" chip, and swipe left/right for alternatives |
| **Prompt bar** ("Style me for a party this weekend!") | Pill-shaped input with soft purple glow and arrow button; weather + conditions shown above result | Keep the natural-language pill as the main entry for outfit generation. Claude parses occasion/weather/mood, then the rule engine builds from owned items only |
| **Outfit card** ("Sequin Glamour") | White card, flat-lay of cut-out items scattered, named look, no avatar | Use the flat-lay "collage" card as the default outfit thumbnail (cheap to render, no GPU). Items link to item detail |
| **Closet grid** | "Newest ▾ · 250 items"; search, select, filter icons; pill category chips (Tops, Dresses, Bottoms, Outerwear, Shoes…); 3-column grid of cut-outs on pale-grey tiles, **brand name bold + product title truncated beneath** | Same grid. Add a small colour-dot and a tiny "Suits you" star on each tile; chips scroll horizontally; long-press = multi-select. Brand + title come from auto-tagging/receipts |
| **AI avatar try-on** | Left rail of item thumbnails (jacket, trousers, bag, shoes) in rounded squares; large avatar wearing the combo on a soft grey gradient | Phase 5. Left rail swaps items live; avatar built from *your* measurements/photo (see Phase 5) |
| **Customize your looks** (dark mode) | Black background; the current look at top as a mini-collage; **carousel rows per category** (Outerwear, Tops, Bottoms…) with the centre item highlighted; eye icon per row to hide a category | **Best interaction to copy** — it's the "mix and match swipe mode" from Phase 2B. Add a live compatibility/suit score that changes as each row scrolls |
| **Daily outfits by weather** | Week strip (Sun–Sat) with silhouette placeholders; today's look card slides up | Same week strip, silhouettes fill with your logged outfits |
| **Trips** | Destination + day count; Calendar / Activities toggle (segmented pill); day tiles with a person wearing the outfit; packing list with category tabs and item count | Same. Packing list computed to maximise outfit combinations from the fewest pieces (a true capsule — this is where Capsule beats Alta) |
| **Plan & log looks** | Month calendar where each day shows a tiny cut-out of that day's outfit; 🔥 streak counter; "+" on empty days | Same, plus wear-frequency heat and "you wore this 3× this month" insight |

**Design takeaways to lock in:**
1. **Cut-outs on a pale neutral stage, no hard borders** — everything feels like a magazine layout.
2. **Pill chips + segmented pills + pill prompt bar**; cards with ~20px radius; very little colour so the clothes carry the colour.
3. **Outfit = named look** ("Chic Brunch"). Names make outfits feel curated; have Claude generate the names.
4. **Three outfit renderings:** collage (default), full-body person cut-out, avatar. Start with the collage; layer the others in later.
5. **Dark mode isn't an afterthought** — Alta's editor screen is black. Do the editor in dark by default.
6. **Streaks/calendar logging** drive retention — include from Phase 2B, not later.
7. **Weather in the header** on Today, always visible.

**Where we deliberately diverge:** every outfit carries a *reason* and a personalisation score tied to your body/colour profile; own-first by default; no scattered shopping items inside closet suggestions; white-on-white fixed with a faint warm-grey tile + soft inner shadow; data export in Settings.

**Known weaknesses to improve on:** white clothes disappearing on white backgrounds (use a subtle warm-grey or tinted card background, soft inner shadow), clunky calendar navigation (swipeable month view), no size field, cluttered shopping nudges (keep shopping in its own tab / opt-in).

**Capsule's visual identity (own it, don't clone):**
- Same calm premium base, but a distinct personality: warm off-white (#FAF8F5) canvas, deep ink text, and **an accent that adapts to the user's colour season** (nice touch: the app's palette gently shifts to the user's best colours).
- Type: a modern grotesque for UI (Inter / General Sans) + an elegant serif for headings/lookbook titles to feel editorial.
- Pill buttons, 16–20px radii, soft layered shadows, generous spacing (4px base grid), large image tiles, smooth bottom-sheet transitions.
- Light + dark mode from day one.

**Navigation (bottom tab bar on mobile, side rail on desktop):**
`Today` (daily outfit from own closet) · `Closet` (items + outfits) · `Looks` (Pinterest-style boards + Shop-the-look) · `Capsule` (planner, gaps, analytics) · `Me` (profile, colour/body/face, avatar, grooming).
A centred **"+" capture button** (camera / gallery / share-in) is the primary action.

**Key screens to design first (in this order):** 1) Goal-first onboarding + profile capture, 2) Bulk-add closet + review queue, 3) Closet grid with cut-outs, 4) Item detail (with "Suits you" reasons), 5) Outfit canvas / dressing room, 6) Daily outfit card with swipe, 7) Looks boards, 8) Shop-the-look result page, 9) Capsule gap analysis.

**Design deliverable in Phase 0:** a clickable HTML prototype of screens 1–6 on a phone-sized viewport so we can feel it before building the backend.

---

## 6. Phased build plan

Timings assume one developer with Claude Code, part-time-ish; adjust. Each phase ends in something you can run and use.

### Phase 0 — Foundations & validation (3–5 days)
- Repo, Next.js PWA shell, SQLite, upload pipeline, design system (colours, type, mobile nav: Closet · Looks · Capsule · Me).
- **Spike the 3 risky bits** with 10 real test images each: (a) image → garment list via Claude vision, (b) garment → product matches via shopping API, (c) face/pose landmarks in-browser.
- Decide: target country/currency, API budget, personal-use vs commercial.
- **Exit:** a go/no-go on match quality; list of retailers that actually return good results.

### Phase 1 — Closet + Boards MVP (1.5–2 weeks)
- Add item by photo/camera/drag-drop → auto background removal → AI auto-tag (category, colour, pattern, formality, season). Edit tags.
- Closet grid with filters; item detail (price, brand, size, wear count, cost-per-wear).
- **Boards (Pinterest-style):** save looks, outfit images, and individual pieces/products into named boards; masonry grid; drag to reorder.
- Manual outfit builder (drag items on canvas) + save outfits; calendar "worn today".
- **Export/import (JSON + images zip)** — day-one trust feature. No item caps.
- **Exit:** you can digitise 30 items in <15 minutes and find an outfit.

### Phase 2 — Style profile engine (1.5–2 weeks)
- **Onboarding:** height, weight (optional), measurements (optional), goals, budget, style preferences (pick-from-images quiz).
- **Colour analysis:** selfie guidance (daylight, no makeup, neutral bg) → sample skin/eye/hair in Lab colour space → 12-season classification with **confidence**; require 2–3 photos to agree; manual season override; show palette + "avoid" swatches. Be explicit about uncertainty.
- **Body shape/proportion:** from MediaPipe pose on a full-body photo *or* typed measurements → shoulder:waist:hip ratios, leg:torso ratio → neutral proportion categories (not "good/bad").
- **Face shape:** MediaPipe landmarks → ratio rules (oval/round/square/heart/oblong/diamond) with confidence; also drives glasses (Phase 6).
- **Rules engine** (transparent, testable): colour theory (undertone, contrast level, complementary/analogous/triadic, 60-30-10), proportion rules (rise, hemline, silhouette balance, V/crew necklines by face/neck), formality/occasion, pattern/texture mixing. Each rule outputs a score + a human-readable reason.
- **Score any item/outfit for you** ("Suits you: 82% — navy is in your palette; high-rise balances your torso:leg ratio").
- **Exit:** every closet item and outfit shows a personalised score and explanation; users can disagree and tune.

### Phase 2B — "My Closet Stylist": restyle what you already own (2–3 weeks) ← core layer, added on your request
**Principle: own-first.** The default answer to "what should I wear?" uses *only* clothes you have. Buying is a secondary, opt-in suggestion. This also fixes Alta's top complaint (it suggests things you don't own).

**A. Get all your clothes in fast (the real bottleneck)**
- Bulk upload: select 20–50 photos at once from gallery, or share from other apps. Hanger/flat-lay/mirror-selfie photos all accepted.
- **Outfit photos too:** a mirror selfie of a full outfit gets split into individual garments (segmentation + Claude vision) and each piece is added to the closet *and* the outfit is saved as a worn look.
- Auto cut-out (clean background), auto-tag, and de-duplicate ("this looks like your existing navy shirt — merge?"). Review queue: one-tap confirm/fix, so tagging errors don't pile up.
- Later: forward purchase receipts / email import, and a browser extension (Whering/Indyx-style).

**B. Pairing engine — "what goes with what" (per-item compatibility graph)**
For every pair/combination of owned items compute a compatibility score from transparent sub-scores:
1. **Colour harmony** — neutrals, analogous/complementary/triadic, 60-30-10, contrast level; plus whether each colour is in *your* palette near your face (tops, scarves, collars matter most).
2. **Silhouette & proportion balance** — fitted-top + wide-bottom, cropped + high-rise, oversized + slim, hem/rise/length vs. your torso:leg ratio and shoulder:hip ratio.
3. **Formality match** — don't pair a tuxedo shirt with gym joggers unless "deliberate contrast" is set.
4. **Pattern/texture mixing** — max one statement pattern, scale contrast, fabric weight.
5. **Season/weather fit** and **occasion fit**.
6. **Your style fingerprint** — learned from what you save, wear, and thumbs-up/down.
Score = weighted sum; weights adapt to your goals. Every score carries a one-line reason ("Olive chinos + cream tee: analogous warm tones, both in your Soft Autumn palette; straight leg balances broad shoulders").

**C. Outfit generation from the closet**
- "Build outfits": pick an anchor piece (that blazer you never wear) → system assembles 5–10 complete outfits (top/bottom/layer/shoes/accessory), ranked by *Suits-you* score. Rule engine generates candidates (fast, explainable, constrained to owned items); Claude re-ranks and writes the explanation. This prevents hallucinated clothes.
- Occasion / weather / mood prompts: "Dinner date, 24°C, smart-casual."
- **Rediscovery:** "You've worn these 3 items once in 6 months — here are 4 new ways to wear them."
- **Never-repeat & rotation** so suggestions don't fixate on neutrals (an Alta complaint).
- **Fit-for-you ranking of what you own:** each closet item gets a "Suits you" badge (e.g. Star / Good / Neutral / Rarely) with the reason, and a "keep / style differently / consider letting go" view for capsule decluttering. Gentle language, no body-judgement.

**D. Personalised to your body (without judging)**
- Uses Phase 2 profile: proportions, height, build, goals ("balance shoulders", "elongate legs", "no preference"), fit preference (relaxed ↔ tailored).
- Garment attributes the model needs per item: neckline, sleeve length, rise, hem length, fit/cut, fabric drape, pattern scale, colour value/saturation/undertone. Auto-extracted from photos; user can correct.
- Feedback loop: ❤️/👎 + "why" chips ("too tight", "colour off", "not my style") feed back into your style fingerprint and weights.

**E. Mix-and-match UI**
- **Outfit canvas:** drag any items together; live *Suits-you* and *Compatibility* meter with reasons.
- **"Add one more" swipe mode:** pick a top, swipe through your best-matching bottoms/shoes/layers; accepted ones go in a lookbook.
- **Plan calendar:** assign outfits to days; avoids repeats; weather-aware.
- **Gap closure link to shopping:** only after own-first results, "this wardrobe is missing a neutral layer: it would unlock +9 outfits" → Phase 3 sourcing.

**Exit:** with 40+ items uploaded, the app produces 10 outfits you'd actually wear, each with a believable reason; fewer than 1 in 10 suggestions includes an item you don't own; thumbs-up rate >60% after a week of feedback.

### Phase 3 — Shop the look (2–3 weeks) ← signature feature
1. Share/upload an image (Instagram/Pinterest screenshot; later: PWA/Android **share-target** so "Share → Capsule" works from those apps).
2. Segment & parse into garments (top, bottom, outerwear, shoes, bag, accessories) with bounding crops + attributes.
3. **Closet match:** "You already own something close" (embedding similarity against your closet).
4. **Product search:** for each missing piece → shopping API / affiliate feed → ranked list: *exact · close · budget alternative*, with price, merchant, rating + review count, delivery/return info where available, **trust flag**, and "fits your palette/proportions" badge.
5. Compare view, price-drop alerts (optional), "Save to board", "add to wishlist", out-link via affiliate URL (disclose).
6. Whole-look cost estimate; "build this look from what you own + N purchases."
- **Exit:** 10 real Pinterest/Instagram looks → ≥70% have at least one acceptable match per visible garment (set your own bar in Phase 0).

### Phase 4 — Capsule engine (1.5–2 weeks) ← the product's identity
- Pick a goal: *work week, travel 10 days, college, minimal 30-piece year-round, etc.*
- Auto-generate/curate a **capsule** from your closet + shortlist: colour-coordinated, maximising outfits-per-piece.
- **Gap analysis:** "Add 1 of these 3 pieces to unlock +N outfits," ranked by value per rupee/dollar; links into Phase 3 sourcing.
- Coverage score (occasions × weather × formality), redundancy detector ("you have 6 near-identical white tees").
- Daily outfit suggestion using weather + calendar + **only items you own** (opt-in toggle for "suggest purchases").
- Analytics: cost-per-wear, least-worn, wear heatmap.

### Phase 5 — Avatar & try-on (2–3 weeks, can run parallel to 4)
- **5a (safe):** 2D parametric avatar from measurements/shape; drag outfits onto it with correct proportions + skin/hair tone; used for silhouette & colour previews.
- **5b:** photo-based try-on (local IDM-VTON/CatVTON for prototype; swap to a licensed try-on API if commercial). Needs GPU — expect slow/limited locally; queue it.
- **5c (optional, later):** 3D avatar from photos via a vendor SDK or SMPL-X-style body model (check licence; SMPL-family is typically non-commercial).
- Always show "preview — approximate" label.

### Phase 6 — Grooming vertical (1–1.5 weeks)
- Hairstyle & beard suggestions by face shape + hair type/density + lifestyle maintenance level; **glasses frames by face shape and colour season**.
- Preview: start with illustrated/overlay suggestions; real-photo hair preview only if you add a generative model (watch licensing/realism complaints — solid-colour hair previews were a top Dressika complaint).
- Link to salon/barber notes: a "show this to your barber" card with reference images and terms.

### Phase 7 — Polish, privacy, Android (2–3 weeks)
- Auth + cloud sync (optional), encrypted storage for body/face photos, delete-all, consent screens.
- Capacitor Android build, camera, share-target, push (price drops, daily outfit), offline closet.
- Performance: image compression, lazy cut-outs, caching; error/empty states; accessibility; inclusive skin-tone QA across a diverse test set (Fitzpatrick I–VI) *before* trusting colour results.
- Play Store requirements: privacy policy, data-safety form, affiliate disclosure.

### Later / ideas
Friend/stylist feedback on outfits (Indyx-style) · resale listing from closet · browser extension to "add to closet" from retailer pages (Whering has it) · sustainability/cost-per-wear nudges · seasonal drops.

---

## 7. Suggested order (updated)
Phase 0 → **1 → 2 (palette + proportions first) → 2B (Closet Stylist) → 3 (Shop the look) → 4 → 5 → 6 → 7.**
Reason: with your new priority, the "wow" is *"upload my clothes and get outfits that suit me from what I already own."* That makes Phase 2B the MVP centrepiece; Phase 3 then reuses the same garment parsing and personalisation to answer "what's missing?" Shop-the-look from Instagram/Pinterest becomes the second headline feature instead of the first.

**Smallest demo-able MVP (about 5–6 weeks):** bulk upload + cut-outs + auto-tags → colour palette + proportions → own-first outfit generator with reasons → boards. Everything else layers on.

## 8. Success metrics (local prototype)
- Time to digitise 30 items < 15 min · tag accuracy > 85% without edit · shop-the-look match acceptance ≥ 70% · colour-season consistency across 3 photos ≥ 90% (same or adjacent season) · cost per analysed look < $0.05.

## 9. Open questions for you
1. **Country & currency/stores** (affects product APIs and affiliate programmes — India vs US/EU is very different)?
2. **Personal tool or future product?** Decides model licences (NC models), affiliate monetisation, and privacy/compliance weight.
3. **Budget** for APIs (Claude vision, shopping search, optional try-on API)?
4. **Do you have a GPU** locally (try-on models need ~12–24 GB VRAM)?
5. **Gender expression handling:** a free-form "style direction" (menswear / womenswear / androgynous / mixed) instead of male/female?
