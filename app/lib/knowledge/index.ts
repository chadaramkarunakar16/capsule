// Capsule's styling knowledge: what hairstyles, beards and frames suit each face shape, how build and height change what
// to wear, how skin tone and colouring guide colour, and grooming basics. It is written down once and used two ways:
//   1. the rule engines (lib/grooming, lib/style) are built on the same guidance, and
//   2. brief() turns the parts relevant to one person into a short briefing the AI reads BEFORE it answers.
//
// Sources cross-checked (Nov 2026): eyewear guides from Warby Parker and Eyebuydirect (frames by face shape), men's and
// women's style guides on dressing by build (layering and fabric weight for lean frames, tonal/vertical lines for fuller
// frames), plus long-standing barbering and tailoring practice. Everything is guidance, never a rule: it describes what a
// garment or cut does, not what a body "should" be.
import type { FaceShape } from "../style/face";
import type { Profile } from "../style/profile";
import { seasonByKey } from "../style/seasons";
import { buildOf, heightBand, type BuildKey, type HeightBand } from "../style/build";

export type FaceKnowledge = { traits: string; hair: { works: string; avoid: string }; beard: { works: string; avoid: string }; glasses: { works: string; avoid: string }; sunglasses: string; neckline: string };

export const FACE_KNOWLEDGE: Record<FaceShape, FaceKnowledge> = {
  oval: {
    traits: "Balanced: slightly narrower at forehead and chin, widest at the cheekbones, about 1.5x as long as wide.",
    hair: { works: "Almost anything: side part, textured crop, quiff, slick-back, bob, long layers. Choose by hair type and upkeep.", avoid: "Heavy fringes that cover the forehead completely, if you want to show off the balance." },
    beard: { works: "Most styles. Keep the outline following the natural jaw: stubble, short boxed, full.", avoid: "Very long beards that stretch a balanced face." },
    glasses: { works: "Most frames. Go as wide as the widest part of the face; square, rectangular, geometric, wide aviators.", avoid: "Frames much narrower than the face, or very heavy decoration that adds length." },
    sunglasses: "Aviators, wayfarers, cat-eye, round: almost all work; keep them as wide as the cheekbones.",
    neckline: "Nearly any neckline or collar.",
  },
  round: {
    traits: "Width and length are close; soft jaw and full cheeks, no strong angles.",
    hair: { works: "Height on top and shorter sides: quiff, pompadour, textured crop with a taper, long layers or lob that fall below the chin, a high bun.", avoid: "Chin-length bobs and full volume at the sides that add width at the cheeks." },
    beard: { works: "Defined, slightly longer at the chin with cleaner cheeks (short boxed, goatee, Van Dyke) to add length and angle.", avoid: "Circle or very full beards that widen the face." },
    glasses: { works: "Angular frames add structure: rectangular, square, geometric, browline, cat-eye.", avoid: "Small round frames that repeat the curves." },
    sunglasses: "Wayfarers, square and rectangular frames, angular cat-eye.",
    neckline: "V-neck, scoop, open collar, polo; high turtlenecks can emphasise roundness.",
  },
  square: {
    traits: "Strong jaw, forehead and jaw similar width, straight sides.",
    hair: { works: "Texture and softness to balance the jaw: textured crop, side part, waves, layers, curtain fringe, or a clean buzz to show the jaw off.", avoid: "Sharp blunt lines at the jaw (a bob ending exactly at the jaw) and very boxy cuts." },
    beard: { works: "Shorter or softer outlines (stubble, short boxed with rounded edges) or a full beard that keeps the jaw clean at the sides.", avoid: "Hard square cheek lines that repeat the angles." },
    glasses: { works: "Curves soften: round, oval, panto, thin or semi-rimless; sit slightly higher on the nose.", avoid: "Heavy square frames that echo the jaw." },
    sunglasses: "Round and oval frames, aviators.",
    neckline: "Rounded crew or scoop necks; a very sharp deep V can echo the jaw.",
  },
  oblong: {
    traits: "Longer than wide with a long forehead or chin; fairly straight cheek lines.",
    hair: { works: "Width and fringe to shorten the face: French crop, curtain fringe, side-swept fringe, waves and fullness at the sides, chin-length bob.", avoid: "Extra height on top (tall quiffs) and very long, flat hair that elongates." },
    beard: { works: "Fuller at the sides, shorter at the chin: full or short boxed, chin strap kept thin; stubble.", avoid: "Pointed or long chin beards that add length." },
    glasses: { works: "Oversized, tall frames with width; round, square or aviator; decorative temples add width.", avoid: "Small narrow rectangles." },
    sunglasses: "Oversized aviators and wide wayfarers.",
    neckline: "Crew, boat or turtleneck to add width; deep V adds length.",
  },
  heart: {
    traits: "Wider at the forehead and cheekbones, narrowing to a smaller chin.",
    hair: { works: "Fullness at or below the chin and a fringe to soften the forehead: side-swept fringe, curtains, bob, lob, textured side part.", avoid: "Lots of volume at the crown that emphasises the top." },
    beard: { works: "Fuller beards that add weight to the jaw: short boxed, full, circle.", avoid: "Very close-cropped chin with a heavy moustache only." },
    glasses: { works: "Frames with weight at the bottom or rounded bases: oval, round, aviator, rimless, light colours.", avoid: "Heavy top-heavy browlines and wide cat-eyes." },
    sunglasses: "Aviators and oval or round frames.",
    neckline: "Scoop, crew and boat to balance a wider forehead.",
  },
  diamond: {
    traits: "Cheekbones are the widest point; narrower forehead and jaw, often a small pointed chin.",
    hair: { works: "Add width at forehead and jaw: side-swept or curtain fringe, chin-length or lob, textured crop with some fringe.", avoid: "Slicked-back styles with side volume that add width at the cheekbones." },
    beard: { works: "Fuller at the jaw and chin to balance the cheekbones: short boxed, full, circle.", avoid: "Beards that are thick at the cheeks and thin at the chin." },
    glasses: { works: "Browline, oval, cat-eye, rimless: lighter bottoms with a slightly stronger brow balance cheekbones.", avoid: "Narrow frames that make the cheekbones look wider." },
    sunglasses: "Browline, oval, cat-eye and rimless styles.",
    neckline: "Scoop or boat neck to balance a narrower forehead and jaw.",
  },
};

export type BuildKnowledge = { what: string; wear: string[]; fabrics: string; avoid: string[] };

export const BUILD_KNOWLEDGE: Record<BuildKey, BuildKnowledge> = {
  lean: {
    what: "A slimmer or lighter frame. The goal is usually to add visual depth, not to hide the frame.",
    wear: [
      "Layer: a tee or shirt under an overshirt, cardigan or jacket gives depth and shape.",
      "Choose pieces with body: denim, flannel, corduroy, twill, chunky knit, tweed and brushed cotton hold their own shape.",
      "Texture and horizontal detail (ribs, stripes, pocket details, cable knit) add presence across the chest and shoulders.",
      "Shoulders that fit at the seam, and structured jackets, build a frame; trousers in straight or relaxed cuts, not skin-tight and not baggy.",
      "Lighter and mid-tone colours, and patterns, add visual weight; darker tones recede.",
    ],
    fabrics: "Mid to heavy weights; avoid thin, clingy single layers.",
    avoid: ["A single thin layer in a tight cut", "All-black head-to-toe skin-tight outfits", "Oversized everything with no structure"],
  },
  average: {
    what: "A mid-range frame: most cuts and fabrics work, so fit and colour matter more than build.",
    wear: ["Fit at the shoulder and the right length are the biggest wins.", "Use your proportions (shoulders vs hips, torso vs legs) to choose where to add or reduce visual weight.", "Mix a fitted piece with a relaxed one for a clear silhouette."],
    fabrics: "Any weight; match to season and occasion.",
    avoid: ["Volume on both top and bottom at once"],
  },
  fuller: {
    what: "A broader or fuller frame. Clothes work best when they skim the body rather than cling or hang loose.",
    wear: [
      "Wear well-fitted pieces: shoulders sitting at the seam, no pulling across the chest or stomach.",
      "Tonal outfits and darker bottoms create a long, clean line; a contrast jacket or open layer adds vertical lines.",
      "Structured mid-weight fabrics (cotton twill, wool blends, ponte) drape cleanly; very clingy knits and stiff boxy fabrics are harder.",
      "V-necks, open collars and unbuttoned layers lengthen the neckline; a jacket ending at the hip or upper thigh balances the body.",
      "Straight or tapered trousers in a solid colour keep the leg line simple.",
    ],
    fabrics: "Mid-weight and structured; avoid very thin clingy fabrics and stiff bulky ones.",
    avoid: ["Pieces that are tight or pulling", "Oversized shapeless layers with no structure", "Large horizontal patterns across the widest point"],
  },
};

export const HEIGHT_KNOWLEDGE: Record<HeightBand, string> = {
  shorter: "Shorter frame (under about 165 cm): keep the line unbroken with tonal outfits, high-rise or mid-rise trousers, cropped or hip-length jackets, and tops that do not fall past the hip; hem trousers precisely and avoid heavy cuffs.",
  average: "Average height: no special constraints; focus on fit and proportion.",
  taller: "Taller frame (over about 182 cm): longer lengths and layering work well, hems and sleeves must be long enough, structure and visual breaks (belts, contrast layers) keep long lines balanced.",
};

export const PROPORTION_KNOWLEDGE = {
  "broader-shoulders": "Broader shoulders: add volume below (straight or wide legs), V-necks and soft shoulder lines; avoid extra width at the shoulder such as boat necks or heavy shoulder pads.",
  "broader-hips": "Hips broader than shoulders: keep attention at the shoulder line with structured shoulders, lighter or brighter tops and darker bottoms; hip-length cropped layers end at the widest point, so go longer or shorter.",
  "longer-torso": "Longer torso: high-rise bottoms and shorter or tucked tops shorten the torso and lengthen the legs.",
  "longer-legs": "Longer legs: longer tops, mid or low rise and layers add balance to the upper half.",
  defined: "Defined waist: fitted cuts and belts show it; a relaxed cut is also fine.",
  straight: "Straighter waist: structured or relaxed cuts and layers create shape.",
} as const;

export const COLOUR_KNOWLEDGE = [
  "Colour guidance comes from the colour season (warm/cool, light/deep, soft/clear). Test near the face: the right colour makes skin look even and eyes bright; the wrong one makes skin look sallow or tired.",
  "Warm undertones usually suit earthy, golden and olive shades; cool undertones suit blue-based colours and crisp whites; neutral undertones are flexible.",
  "Deeper skin tones often carry rich, saturated and jewel colours well; very pale pastels or ashy greys can wash out near the face, so keep them lower down or add a stronger colour at the neck.",
  "Lighter skin tones often suit softer to medium depth; very stark black or white near the face can be harsh on soft colouring.",
  "Colours worn away from the face (trousers, shoes, bags) matter far less than tops, scarves and outerwear.",
];

export const GROOMING_BASICS = [
  "Haircut: ask for a cut that works with your natural texture and growth, and book trims on schedule (short styles 3-5 weeks, longer cuts 8-12 weeks).",
  "Skin: a gentle cleanser, a moisturiser and daily sunscreen cover most needs; add one active (such as a retinoid or vitamin C) slowly if you want more.",
  "Beard: keep the neckline about two finger-widths above the Adam's apple and a clean cheek line; trim or shape every 1-2 weeks; use beard oil or balm if the skin underneath is dry.",
  "Brows: tidy stray hairs only; keep the natural shape.",
  "Glasses: frame width should be about as wide as the widest part of the face, the bridge should sit without slipping, and the top of the frame should follow the brow line.",
  "Fit and tailoring: a small alteration (sleeve length, hem, waist) usually improves an outfit more than a new item.",
  "Posture, sleep, hydration and regular movement change how every outfit looks; they matter more than any single product.",
  "Healthy approach: look for the best version of what you have. Skip extreme or unsafe tricks and treat all of this as options, not as a measure of worth.",
];

/** Everything the AI should know about this person's situation, kept short. */
export function brief(p: Profile, topic: "grooming" | "outfits" | "all" = "all"): string {
  const lines: string[] = [];
  const fs = p.face.shape;
  const season = seasonByKey(p.color.season);
  const bk = buildOf(p), hb = heightBand(p.basics.height);

  lines.push("PERSON");
  const who = [p.basics.direction && `style direction: ${p.basics.direction}`, p.basics.height && `height ${p.basics.height} cm`, p.basics.weight && `weight ${p.basics.weight} kg`, p.basics.fit && `fit preference: ${p.basics.fit}`].filter(Boolean);
  lines.push(`- ${who.join("; ") || "no basics given"}`);
  if (bk) lines.push(`- build: ${bk.key} (${bk.source})`);
  if (p.body.shoulderHip || p.body.torsoLeg || p.body.waist) lines.push(`- proportions: ${[p.body.shoulderHip, p.body.torsoLeg, p.body.waist].filter(Boolean).join(", ")}`);
  if (season) lines.push(`- colouring: ${season.name}${p.avatar.skin ? `, skin tone about ${p.avatar.skin}` : ""}`);
  else if (p.avatar.skin) lines.push(`- skin tone about ${p.avatar.skin}`);
  if (p.basics.aims.length) lines.push(`- goals: ${p.basics.aims.join("; ")}`);
  if (fs) lines.push(`- face shape: ${fs}${p.face.auto && !p.face.overridden ? ` (estimated from a photo, ${Math.round(p.face.auto.confidence * 100)}% sure)` : ""}${p.face.wearsGlasses ? "; wears glasses" : ""}`);
  const g = p.grooming;
  const gl = [g.hairType && `hair ${g.hairType}`, g.density && `${g.density} density`, g.receding && "receding hairline", g.length && `${g.length} length now`, g.maintenance && `upkeep level ${g.maintenance}/3`, g.facialHair && (g.beardGrowth ? `beard growth ${g.beardGrowth}` : "open to facial hair")].filter(Boolean);
  if (gl.length) lines.push(`- hair/grooming: ${gl.join("; ")}`);

  if ((topic === "grooming" || topic === "all") && fs) {
    const k = FACE_KNOWLEDGE[fs];
    lines.push("", `KNOWLEDGE: ${fs.toUpperCase()} FACE`, `- ${k.traits}`, `- Hair works: ${k.hair.works}`, `- Hair avoid: ${k.hair.avoid}`, `- Beard works: ${k.beard.works}`, `- Beard avoid: ${k.beard.avoid}`, `- Glasses work: ${k.glasses.works}`, `- Glasses avoid: ${k.glasses.avoid}`, `- Sunglasses: ${k.sunglasses}`);
  }
  if (topic === "outfits" || topic === "all") {
    if (fs) lines.push("", `KNOWLEDGE: NECKLINES FOR A ${fs.toUpperCase()} FACE`, `- ${FACE_KNOWLEDGE[fs].neckline}`);
    if (bk) { const k = BUILD_KNOWLEDGE[bk.key]; lines.push("", `KNOWLEDGE: ${bk.key.toUpperCase()} BUILD`, `- ${k.what}`, ...k.wear.map((w) => `- ${w}`), `- Fabrics: ${k.fabrics}`, `- Avoid: ${k.avoid.join("; ")}`); }
    if (hb) lines.push("", "KNOWLEDGE: HEIGHT", `- ${HEIGHT_KNOWLEDGE[hb]}`);
    const prop = [p.body.shoulderHip, p.body.torsoLeg, p.body.waist].filter((x): x is keyof typeof PROPORTION_KNOWLEDGE => !!x && x in PROPORTION_KNOWLEDGE);
    if (prop.length) lines.push("", "KNOWLEDGE: PROPORTIONS", ...prop.map((x) => `- ${PROPORTION_KNOWLEDGE[x]}`));
    lines.push("", "KNOWLEDGE: COLOUR", ...COLOUR_KNOWLEDGE.map((c) => `- ${c}`));
    if (season) lines.push(`- Best colours for ${season.name}: ${season.best.slice(0, 6).join(", ")}; neutrals: ${season.neutrals.slice(0, 3).join(", ")}; use sparingly near the face: ${season.avoid.slice(0, 3).join(", ")}`);
  }
  if (topic === "grooming" || topic === "all") lines.push("", "KNOWLEDGE: GROOMING BASICS", ...GROOMING_BASICS.map((c) => `- ${c}`));
  return lines.join("\n");
}

export const ADVISOR_RULES = `You are Capsule's personal stylist and grooming advisor. Read the PERSON and KNOWLEDGE sections first and base every answer on them; do not contradict them.
Rules: be specific and practical; explain WHY in terms of this person's face shape, build, height, proportions and colouring; use only options that exist in the lists you are given; never judge or rank bodies or faces, never suggest surgery, drugs, crash diets or anything unsafe; if information is missing, say what to add instead of guessing; keep the tone warm and plain.`;

/**
 * A short factual summary of who the AI is helping, taken from the profile (which the face and body photo analysis
 * fills in). It goes in front of EVERY AI call so all features are consistent with what the photos revealed.
 */
export function personSummary(p: Profile): string {
  const bk = buildOf(p), hb = heightBand(p.basics.height), season = seasonByKey(p.color.season);
  const bits: string[] = [];
  if (p.basics.direction) bits.push(`style direction ${p.basics.direction}`);
  if (p.basics.height) bits.push(`${p.basics.height} cm${hb ? ` (${hb})` : ""}`);
  if (bk) bits.push(`${bk.key} build`);
  const prop = [p.body.shoulderHip, p.body.torsoLeg, p.body.waist].filter(Boolean);
  if (prop.length) bits.push(`proportions: ${prop.join(", ")}`);
  if (season) bits.push(`colouring: ${season.name}${p.avatar.skin ? ` (skin about ${p.avatar.skin})` : ""}`);
  if (p.face.shape) bits.push(`${p.face.shape} face${p.face.wearsGlasses ? ", wears glasses" : ""}`);
  const g = p.grooming;
  if (g.hairType) bits.push(`${g.hairType} ${g.density ?? ""} hair${g.receding ? ", receding hairline" : ""}`.replace("  ", " "));
  if (g.facialHair) bits.push(g.beardGrowth ? `beard growth ${g.beardGrowth}` : "open to facial hair");
  if (p.basics.fit) bits.push(`prefers ${p.basics.fit.toLowerCase()} fits`);
  if (p.basics.aims.length) bits.push(`goals: ${p.basics.aims.join("; ")}`);
  const photos = [p.body.source === "photo" ? "body" : "", p.face.auto ? "face" : ""].filter(Boolean);
  return bits.length ? `- About this person: ${bits.join("; ")}.${photos.length ? ` (Read from their ${photos.join(" and ")} photo${photos.length > 1 ? "s" : ""}; stay consistent with it.)` : ""}` : "";
}
