# Capsule

A capsule-wardrobe and personal-style app for Windows. Photograph your clothes, build outfits from what you already own, get styling suggestions based on colour season, proportions and face shape, and find legitimate sources for pieces you want. Your library stays on your own PC.

- **`app/`** — the application (Next.js + Electron). Start with [app/README.md](app/README.md) for install, build and feature notes.
- **`CAPSULE_PLAN.md`** — the market research and phase-by-phase plan this was built from.
- **`prototype/`** — the first static design prototype.

AI features are optional and use your own Gemini API key (Me → AI); keys are stored only on your PC and never displayed. Nothing is uploaded unless you use one of them.

What it does: a closet and outfit builder; a stylist that reads a styling knowledge base (face shape → hair, beard and glasses; build and height → layering and fit; colouring → colour) before it answers; a live avatar you can build from your own photos; photo try-on; shopping-link search; encrypted backup and a PIN lock.

```bash
cd app
npm install
npm run dev          # http://127.0.0.1:3000
npm run desktop:dist # Windows installer in app/dist
```

No license has been chosen yet, so all rights are reserved by default; add a `LICENSE` file if you want others to be able to reuse the code.
