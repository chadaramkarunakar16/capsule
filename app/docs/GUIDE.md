# Capsule: how to use it, and how the AI works

## The idea in one minute
You give Capsule two photos of yourself (face and full body) and photos of your clothes. The AI reads them once, writes what it learns into **one profile**, and every feature (outfit scoring, the stylist, hairstyle and glasses ideas, try-on, shopping, the avatar) works from that same profile. The more you use it, the **AI brain** learns your taste and feeds it back into every AI call.

Nothing runs on your computer except the app itself. All smart features use **your own Gemini or OpenAI key**.

## First 10 minutes, step by step

1. **Open Capsule** from the Desktop shortcut.
2. **Add your AI key.** Me → AI → paste a Gemini key (or an OpenAI key) → Save. It is stored on your PC and never shown again (use *Edit key* to change it). Leave quality on *Economy*.
3. **Add your photos.** Me → My avatar → **Add my photos**.
   - *Face photo*: front-facing, daylight, hair back. The AI reads your face shape, skin tone, eye and hair colour, hair type and density, glasses and facial hair.
   - *Full-body photo*: standing straight, feet in frame, fitted clothes if you can. The AI reads shoulders vs hips, torso vs legs, waist and build.
   - Press **Use as my avatar** on a photo if you want it kept on this PC (needed for the avatar picture and for "try on my photo" without re-uploading). Otherwise the photo is read and not stored.
4. **Check what it found.** The same screen shows everything the AI set (face shape, proportions, colour season, skin and hair colour). Change anything that feels wrong; your choice always wins over the AI's guess. Fill in height and weight (optional) so the build is exact. *Me → Your style profile* has the same answers as questions (About you, Proportions, Colour, Face shape), with your avatar beside them.
5. **Choose how you appear.** My avatar → *How I appear*: simple figure, your photo, or **Create an AI image of me** (made from your photos, in plain fitted clothes so your real build is clear).
6. **Add your clothes.** Press **+ Add piece** → *Choose photos*.
   - A photo of **one piece** becomes one item.
   - A photo of **a whole outfit** is separated automatically: shirt, trousers, jacket, shoes, bag each become their own piece, and the outfit is saved too.
   - Optional: *Clean AI cut-outs* (about 4 cents each) puts each piece on a plain background.
   - New pieces wait in **Review** (Closet → "to review"): fix any wrong tag, then Confirm. Your corrections teach the AI brain.
7. **Browse the closet.** Closet → Items. Search, filter, sort by "Suits you". Open a piece to see *How it suits you* with reasons based on your colouring, proportions, face, build and height. **Select** lets you pick several pieces (or outfits) and delete them; **Delete** is also in the header of every piece, outfit and inspiration look.
8. **Build outfits.** Closet → Outfits → New outfit (or *Build an outfit* on a piece). The live score explains what works. *Today* has *Style me* for daily suggestions and *Log outfit* for what you wore.
9. **Try outfits on yourself.**
   - **Try on me** is on Closet (top row), on every piece, in the outfit builder, and under Me → My avatar → *Try outfits on me*.
   - It first shows your avatar (or your photo / AI image). Press **On my photo** to have the AI dress your saved photo with the pieces (a few cents per picture).
10. **Hair, beard, glasses.** Me → Hair, beard & glasses: ranked styles for your face shape and hair type, with what to tell your barber. *Frames on my photo* shows glasses on you.
11. **Your stylist.** Me → Your stylist: *Hair, beard & glasses* and *Outfits* advice written for you (build, height, proportions, colouring), using only styles that exist in the app and pieces you own. Tick the box to let it look at your photo or AI image.
12. **Shop a look.** + → *Shop a look*: add a photo or link of an outfit you love. The AI lists every piece (top, bottom, shoes...). They appear under **Closet → Inspo & buy** and on the Capsule tab as *To buy*. Mark each *Got it* or *Not interested*, find live prices, save products to your wishlist.
13. **Plan.** Capsule tab: capsule wardrobes, trips, gaps (what to buy for the most new outfits), cost per wear.
14. **Look after your data.** Me → Privacy & data: what is stored, an encrypted backup, and Delete everything.

## How the AI works

### One key, four kinds of job
| Job | What it does | Gemini (Economy) | OpenAI (Economy) |
|---|---|---|---|
| read | tag a piece, read your face and body photo, update brain notes | `gemini-3.5-flash-lite` | `gpt-6-luna` |
| think | split an outfit photo, read an inspiration look, stylist advice | same | same |
| edit | try-on, glasses on your photo, clean cut-outs | `gemini-2.5-flash-image` | `gpt-image-2.5-flare` |
| likeness | the AI picture of you | `gemini-3.1-flash-image` | `gpt-image-2.5-sunburst` |

*Better* quality upgrades *think* and *edit* to `gemini-3.6-flash` / `gpt-6.1-terra` and the stronger image models. If you save both keys, choose which one to use in Me → AI.

### Everything is synced through the profile
1. **You give photos** (face, body) → the AI returns facts (face shape, colours, proportions, build, hair details).
2. Capsule writes them into **your profile** (never overwriting what you set yourself).
3. Every other feature reads that profile:
   - outfit and piece scoring (colour season, proportions, face-shape necklines, build layering, height lengths),
   - hairstyle, beard and glasses ranking,
   - the stylist (it also reads the knowledge base: what suits each face shape and build),
   - try-on and the avatar (skin, hair, proportions),
   - the shopping queries for inspiration looks.
4. A short **"About this person"** summary of that profile is put in front of **every AI call**, so even tagging and outfit-splitting stay consistent with what your photos showed.

### The AI brain (it learns from you)
Capsule quietly notes what you do: pieces you confirm or **correct**, outfits you like or pass on, what you wear, save, shop and ask for. Every dozen or so actions the AI rewrites a short portrait of your taste and a few rules ("suggest a layer over tees", "overshirts count as outerwear"). That portrait, plus a summary of your closet, goes in front of every AI call. Me → AI brain shows what it learned and lets you pause, refresh or erase it. Only short text is shared, never photos.

### What leaves your PC
Only what you trigger: the photo for a read, an edit, a try-on or the AI picture, plus short text summaries. Nothing is stored by Capsule's servers because there are none. Photos are not kept unless you press *Use as my avatar*.

## What it costs (estimates)
Text features: a fraction of a cent each. Pictures: about 4 cents for try-on, glasses and cut-outs, about 7 cents for the AI picture of you. A normal month is around a dollar; heavy use with many try-ons is a few dollars.

## If something looks wrong
- **A photo shows "No photo"**: the file is gone from this PC (for example after Delete everything). Add it again.
- **"Add an AI key"**: Me → AI.
- **A try-on or the AI picture doesn't look like you**: use a clearer, front-facing, well-lit photo, press the button again, or switch to *Better* quality.
- **OpenAI image errors**: image models can require your OpenAI organisation to be verified.
