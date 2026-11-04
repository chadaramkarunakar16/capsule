// Hair, facial-hair and frame catalogues. Deliberately unisex: styles are described by what they are, not who "should" wear them.
// Face-shape scores run −2 (works against the shape) … +2 (flatters it). They are classic styling guidance, not rules.
import type { FaceShape } from "../style/face";

export type HairType = "straight" | "wavy" | "curly" | "coily";
export type Density = "thin" | "medium" | "thick";
export type Fit = Partial<Record<FaceShape, number>>;

export type HairIllus = {
  top: number;                       // volume above the forehead, 0..1
  sides: "fade" | "tapered" | "full";
  length: "buzz" | "short" | "chin" | "shoulder" | "long";
  part: "none" | "side" | "center";
  fringe: "none" | "side" | "curtain" | "full";
  wave: number;                      // 0 straight … 1 very wavy
  extra?: "bun" | "braids" | "afro" | "locs" | "ponytail";
};

export type HairStyle = {
  id: string;
  name: string;
  group: "short" | "medium" | "long";
  textures: HairType[];              // hair types it works well with
  thinOK: boolean;                   // looks good on thinner hair
  recedingOK: boolean;
  maintenance: 1 | 2 | 3;            // 1 = wash and go … 3 = daily styling and regular cuts
  trimWeeks: number;                 // typical time between cuts to keep the shape
  growMonths?: number;               // roughly, from a short cut
  faces: Fit;
  ask: string;                       // what to say to the stylist
  tips: string[];
  avoid?: string;
  illus: HairIllus;
};

export const HAIRSTYLES: HairStyle[] = [
  { id: "buzz", name: "Buzz cut", group: "short", textures: ["straight", "wavy", "curly", "coily"], thinOK: true, recedingOK: true, maintenance: 1, trimWeeks: 3,
    faces: { oval: 2, square: 2, heart: 1, diamond: 0, oblong: 0, round: -1 },
    ask: "A clipper cut all over, one length, around a number 2–3 guard (about 6–10 mm). Keep the hairline natural and tidy the neckline.",
    tips: ["Moisturise your scalp — there's no hair to cover it.", "A slightly longer top (number 4) is kinder if you're unsure."], avoid: "Rounder faces can look rounder with no height — keep a little length on top.",
    illus: { top: 0.02, sides: "full", length: "buzz", part: "none", fringe: "none", wave: 0 } },
  { id: "textured-crop", name: "Textured crop", group: "short", textures: ["straight", "wavy", "curly"], thinOK: true, recedingOK: true, maintenance: 2, trimWeeks: 5,
    faces: { oval: 2, round: 2, square: 1, heart: 1, diamond: 1, oblong: 0 },
    ask: "A short textured top, about 5–7 cm, point-cut so it sits messy. Low or mid taper on the sides and back, and a slightly forward fringe.",
    tips: ["A pea-sized dab of matte clay, worked through dry hair.", "Ask for the sides to blend, not shave."], illus: { top: 0.22, sides: "tapered", length: "short", part: "none", fringe: "side", wave: 0.3 } },
  { id: "french-crop", name: "French crop", group: "short", textures: ["straight", "wavy"], thinOK: true, recedingOK: true, maintenance: 2, trimWeeks: 4,
    faces: { oval: 2, square: 2, round: 1, heart: 0, diamond: 1, oblong: 1 },
    ask: "Short, even length on top with a straight, short fringe cut across the forehead, and a taper or fade on the sides.",
    tips: ["A short fringe makes a long forehead look shorter.", "Use a light paste and push the fringe forward."], illus: { top: 0.12, sides: "fade", length: "short", part: "none", fringe: "full", wave: 0 } },
  { id: "side-part", name: "Classic side part", group: "short", textures: ["straight", "wavy"], thinOK: true, recedingOK: true, maintenance: 2, trimWeeks: 4,
    faces: { oval: 2, square: 1, round: 1, oblong: 1, heart: 1, diamond: 0 },
    ask: "Scissor-cut on top, long enough to part (about 6–8 cm), tapered sides and neckline. Part on the natural side, about 2 cm above the outer eyebrow.",
    tips: ["Comb while damp, then dry in the direction of the part.", "Works well on fine hair."], illus: { top: 0.18, sides: "tapered", length: "short", part: "side", fringe: "none", wave: 0.1 } },
  { id: "quiff", name: "Quiff / pompadour", group: "short", textures: ["straight", "wavy"], thinOK: false, recedingOK: false, maintenance: 3, trimWeeks: 3,
    faces: { round: 2, oval: 1, square: 1, heart: 1, diamond: 0, oblong: -1 },
    ask: "Longer on top (about 8–10 cm) swept up and back, with a skin or low fade on the sides. Keep the length at the front so it can lift.",
    tips: ["Blow-dry upward and back with a round brush, then set with pomade or clay.", "Needs a hairdryer most mornings."], avoid: "Adds height — skip on a long (oblong) face.",
    illus: { top: 0.55, sides: "fade", length: "short", part: "none", fringe: "none", wave: 0.2 } },
  { id: "slick-back", name: "Slick-back with tapered sides", group: "short", textures: ["straight", "wavy"], thinOK: false, recedingOK: false, maintenance: 3, trimWeeks: 4,
    faces: { oval: 2, square: 1, round: 1, heart: 0, diamond: 0, oblong: -1 },
    ask: "Keep the length on top (about 8–10 cm), taper the sides and back, and leave enough weight to comb straight back.",
    tips: ["Comb back while damp with a light-hold gel or pomade.", "Best with a defined hairline."], illus: { top: 0.28, sides: "tapered", length: "short", part: "none", fringe: "none", wave: 0 } },
  { id: "taper-curls", name: "Tapered curls", group: "short", textures: ["curly", "coily", "wavy"], thinOK: true, recedingOK: true, maintenance: 2, trimWeeks: 3,
    faces: { oval: 2, round: 2, square: 1, heart: 1, diamond: 1, oblong: 0 },
    ask: "Keep your curl length on top (about 6–8 cm), cut dry so the curl pattern shows, with a low or mid taper on the sides and back.",
    tips: ["Define curls with a leave-in and a curl cream on damp hair.", "A curl sponge or finger-twirl adds definition."], illus: { top: 0.4, sides: "tapered", length: "short", part: "none", fringe: "none", wave: 0.9 } },
  { id: "short-natural", name: "Short natural / tapered TWA", group: "short", textures: ["coily", "curly"], thinOK: true, recedingOK: true, maintenance: 1, trimWeeks: 4,
    faces: { oval: 2, square: 2, round: 1, heart: 1, diamond: 1, oblong: 0 },
    ask: "Shape your natural texture short and even on top (2–4 cm), with a clean taper around the ears and neckline.",
    tips: ["Moisture first: water-based leave-in, then a light oil or butter.", "Pick out upward to build height."], illus: { top: 0.3, sides: "tapered", length: "short", part: "none", fringe: "none", wave: 1, extra: "afro" } },
  { id: "pixie", name: "Pixie", group: "short", textures: ["straight", "wavy", "curly"], thinOK: true, recedingOK: true, maintenance: 2, trimWeeks: 5,
    faces: { oval: 2, heart: 2, diamond: 2, square: 1, round: 0, oblong: 0 },
    ask: "A short cropped cut, longer on top (about 5–8 cm) and shorter at the sides and nape, with a wispy side-swept fringe.",
    tips: ["Fine hair gains body from the short layers.", "Shape needs trimming often to stay sharp."], illus: { top: 0.2, sides: "tapered", length: "short", part: "side", fringe: "side", wave: 0.2 } },
  { id: "bob", name: "Chin-length bob", group: "medium", textures: ["straight", "wavy"], thinOK: true, recedingOK: true, maintenance: 2, trimWeeks: 8,
    faces: { oval: 2, oblong: 2, square: 1, heart: 1, diamond: 1, round: -1 },
    ask: "A blunt bob that ends at the chin, with a clean line. For softness ask for light internal layers; for a rounder face go slightly longer than the chin.",
    tips: ["A flat iron or round brush gives the polished finish.", "Thin hair looks fuller with one blunt length."], avoid: "A bob that ends right at the widest part of a round face adds width.",
    illus: { top: 0.1, sides: "full", length: "chin", part: "side", fringe: "none", wave: 0 } },
  { id: "lob", name: "Long bob (lob)", group: "medium", textures: ["straight", "wavy", "curly"], thinOK: true, recedingOK: true, maintenance: 2, trimWeeks: 10, growMonths: 8,
    faces: { oval: 2, round: 2, square: 1, oblong: 1, heart: 1, diamond: 1 },
    ask: "A bob that falls to the collarbone, with soft long layers and a slight angle longer at the front.",
    tips: ["The length below the chin visually lengthens a round face.", "Easy to wear straight, wavy or tucked behind the ears."], illus: { top: 0.1, sides: "full", length: "shoulder", part: "side", fringe: "none", wave: 0.3 } },
  { id: "shag", name: "Shag / layered mid-length", group: "medium", textures: ["wavy", "curly", "straight"], thinOK: false, recedingOK: true, maintenance: 2, trimWeeks: 10, growMonths: 8,
    faces: { oval: 2, round: 1, square: 1, oblong: 1, heart: 1, diamond: 1 },
    ask: "Choppy layers from the crown down, with face-framing pieces around the cheekbones. Keep the length at the shoulder or just above.",
    tips: ["Air-dry with a texture spray for movement.", "Layers add volume, so it can overwhelm very fine hair."], illus: { top: 0.3, sides: "full", length: "shoulder", part: "center", fringe: "curtain", wave: 0.6 } },
  { id: "curtains", name: "Curtain fringe, mid-length", group: "medium", textures: ["straight", "wavy"], thinOK: true, recedingOK: true, maintenance: 1, trimWeeks: 10, growMonths: 6,
    faces: { oval: 2, heart: 2, diamond: 2, round: 1, square: 1, oblong: 0 },
    ask: "Mid-length (ears to chin) with a centre part and a long fringe that sweeps to each side, blended into the length.",
    tips: ["Dry it with a round brush, flicking the fringe outward.", "Softens a broad forehead or strong brow."], illus: { top: 0.15, sides: "full", length: "chin", part: "center", fringe: "curtain", wave: 0.3 } },
  { id: "medium-flow", name: "Medium flow", group: "medium", textures: ["straight", "wavy", "curly"], thinOK: false, recedingOK: false, maintenance: 1, trimWeeks: 12, growMonths: 9,
    faces: { oval: 2, square: 1, round: 1, oblong: 0, heart: 1, diamond: 1 },
    ask: "Hair to the ears or collar, even length with light layers so it falls naturally. Tidy the neckline only.",
    tips: ["Lowest effort on this list — a good shampoo, conditioner and a wide-tooth comb.", "Add a salt spray for wave."], illus: { top: 0.2, sides: "full", length: "chin", part: "none", fringe: "side", wave: 0.5 } },
  { id: "curly-shape", name: "Shaped curls (mid-length)", group: "medium", textures: ["curly", "coily"], thinOK: true, recedingOK: true, maintenance: 2, trimWeeks: 10, growMonths: 10,
    faces: { oval: 2, round: 1, square: 1, oblong: 1, heart: 0, diamond: 1 },
    ask: "A dry cut by a curl specialist: layers shaped to a rounded silhouette, so the curls stack without a triangle shape.",
    tips: ["Curls are cut dry, curl by curl.", "Plop or diffuse to keep definition."], illus: { top: 0.5, sides: "full", length: "chin", part: "none", fringe: "none", wave: 1 } },
  { id: "long-layers", name: "Long layers", group: "long", textures: ["straight", "wavy", "curly"], thinOK: false, recedingOK: true, maintenance: 2, trimWeeks: 12, growMonths: 18,
    faces: { round: 2, oval: 2, square: 1, heart: 1, diamond: 1, oblong: -1 },
    ask: "Keep the length and add long layers starting at the chin or lower, so the hair moves without losing length.",
    tips: ["Vertical lines from the length slim a round or square face.", "Trim ends every 3 months."], avoid: "Very long, flat hair lengthens an oblong face — add volume at the sides instead.",
    illus: { top: 0.1, sides: "full", length: "long", part: "center", fringe: "none", wave: 0.4 } },
  { id: "face-frame", name: "Long with face-framing bangs", group: "long", textures: ["straight", "wavy"], thinOK: true, recedingOK: true, maintenance: 2, trimWeeks: 6, growMonths: 18,
    faces: { heart: 2, diamond: 2, oblong: 2, oval: 2, round: 1, square: 1 },
    ask: "Long hair with curtain bangs or a soft side-swept fringe that starts around the cheekbone and blends into the layers.",
    tips: ["Bangs need a trim every 4–6 weeks.", "A fringe shortens a long face and balances a wide forehead."], illus: { top: 0.12, sides: "full", length: "long", part: "center", fringe: "curtain", wave: 0.3 } },
  { id: "braids", name: "Braids (box, knotless or cornrows)", group: "long", textures: ["coily", "curly"], thinOK: true, recedingOK: true, maintenance: 2, trimWeeks: 8,
    faces: { oval: 1, round: 1, square: 1, oblong: 1, heart: 1, diamond: 1 },
    ask: "Say the style, size (small, medium or jumbo) and length; ask for a lightweight, low-tension install and a natural-looking parting.",
    tips: ["Keep the scalp moisturised and avoid tight edges.", "Wear for 6–8 weeks, then rest your hair."], illus: { top: 0.15, sides: "full", length: "long", part: "center", fringe: "none", wave: 0, extra: "braids" } },
  { id: "locs", name: "Locs", group: "long", textures: ["coily", "curly"], thinOK: true, recedingOK: true, maintenance: 1, trimWeeks: 8, growMonths: 12,
    faces: { oval: 2, round: 1, square: 2, oblong: 1, heart: 1, diamond: 1 },
    ask: "Talk through starting method (comb coils, twists or interlocking), size and parting with a loctician. Regular retwists keep roots neat.",
    tips: ["A long-term commitment — start with a consultation.", "Wash with residue-free shampoo."], illus: { top: 0.15, sides: "full", length: "long", part: "none", fringe: "none", wave: 0, extra: "locs" } },
  { id: "high-bun", name: "High bun / top-knot", group: "long", textures: ["straight", "wavy", "curly", "coily"], thinOK: true, recedingOK: true, maintenance: 1, trimWeeks: 14, growMonths: 12,
    faces: { round: 2, oval: 2, square: 1, heart: 1, diamond: 1, oblong: 0 },
    ask: "No cut needed — a few long layers help it sit smoothly. Wear it high to lengthen the face.",
    tips: ["Use a soft scrunchie to avoid breakage.", "Pull a few strands loose to frame the face."], illus: { top: 0.1, sides: "tapered", length: "short", part: "none", fringe: "none", wave: 0, extra: "bun" } },
  { id: "low-pony", name: "Low ponytail", group: "long", textures: ["straight", "wavy", "curly", "coily"], thinOK: true, recedingOK: true, maintenance: 1, trimWeeks: 14, growMonths: 12,
    faces: { oval: 2, round: 1, square: 1, oblong: 1, heart: 1, diamond: 1 },
    ask: "No cut needed. A few face-framing layers or a fringe keep it from looking severe.",
    tips: ["Smooth with a bit of oil or cream.", "Good gym-to-office option."], illus: { top: 0.08, sides: "tapered", length: "long", part: "center", fringe: "none", wave: 0.1, extra: "ponytail" } },
  { id: "big-curls", name: "Natural volume / afro", group: "medium", textures: ["coily", "curly"], thinOK: false, recedingOK: true, maintenance: 3, trimWeeks: 8,
    faces: { oval: 2, round: 1, square: 1, oblong: 1, heart: 1, diamond: 1 },
    ask: "Shape your natural texture into a rounded silhouette, trimming split ends and keeping the line even all around.",
    tips: ["Detangle on damp, conditioned hair with fingers or a wide comb.", "A satin bonnet at night protects shape and moisture."], illus: { top: 0.6, sides: "full", length: "short", part: "none", fringe: "none", wave: 1, extra: "afro" } },
];

/* ------------------------------------------------------------------ facial hair */

export type BeardStyle = {
  id: string; name: string;
  patchyOK: boolean;                 // works if growth is patchy or thin
  maintenance: 1 | 2 | 3;
  trimDays: number;
  faces: Fit;
  ask: string; tips: string[]; avoid?: string;
  illus: { kind: "none" | "stubble" | "short" | "full" | "goatee" | "vandyke" | "circle" | "strap"; length: number };
};

export const BEARDS: BeardStyle[] = [
  { id: "clean", name: "Clean-shaven", patchyOK: true, maintenance: 3, trimDays: 1, faces: { oval: 1, square: 1, round: 0, oblong: 0, heart: 1, diamond: 0 },
    ask: "Nothing to ask — shave with the grain, then against it for a close finish.", tips: ["Hot towel first, a sharp razor, then an alcohol-free aftershave balm."], illus: { kind: "none", length: 0 } },
  { id: "stubble", name: "Designer stubble", patchyOK: true, maintenance: 2, trimDays: 3, faces: { oval: 2, square: 2, round: 1, oblong: 0, heart: 1, diamond: 1 },
    ask: "Trimmer with a number 1–2 guard (1–3 mm) all over, with a clean neckline just above the Adam's apple and cheek line kept natural.", tips: ["Takes 3–5 days of growth.", "Trim every 2–3 days to keep it intentional."], illus: { kind: "stubble", length: 0.2 } },
  { id: "short-boxed", name: "Short boxed beard", patchyOK: false, maintenance: 2, trimDays: 7, faces: { round: 2, oval: 2, square: 1, heart: 1, diamond: 2, oblong: 1 },
    ask: "Trim to about 6–10 mm, faded into the sideburns, with a sharp neckline two fingers above the Adam's apple and a defined cheek line.", tips: ["Keep the cheek line straight and high for a slimming effect.", "Beard oil softens as it grows."], illus: { kind: "short", length: 0.4 } },
  { id: "full", name: "Full beard", patchyOK: false, maintenance: 2, trimDays: 10, faces: { oblong: 2, heart: 2, oval: 2, diamond: 1, square: 1, round: 0 },
    ask: "Keep length on the cheeks and chin (about 2–3 cm), with a rounded outline, a clean neckline and a trimmed moustache above the lip.", tips: ["Fuller sides widen a long face.", "Wash with beard shampoo, comb and oil."], avoid: "Long chin length lengthens an already long or round face.", illus: { kind: "full", length: 0.7 } },
  { id: "goatee", name: "Goatee", patchyOK: true, maintenance: 2, trimDays: 5, faces: { round: 2, oval: 2, oblong: 0, square: 1, heart: 0, diamond: 1 },
    ask: "Keep the hair on the chin and around the mouth (about 6 mm), shave the cheeks and neck clean, with a defined outline.", tips: ["Adds length to a round face.", "A great option when cheeks are thin."], illus: { kind: "goatee", length: 0.5 } },
  { id: "van-dyke", name: "Van Dyke", patchyOK: true, maintenance: 3, trimDays: 4, faces: { round: 2, oval: 2, square: 1, oblong: 0, heart: 1, diamond: 1 },
    ask: "A pointed chin beard and a separate moustache, with clean-shaven cheeks and a disconnected line between them.", tips: ["Use wax on the moustache ends.", "Needs a steady hand — ask your barber for the outline."], illus: { kind: "vandyke", length: 0.55 } },
  { id: "circle", name: "Circle beard", patchyOK: true, maintenance: 2, trimDays: 5, faces: { round: 1, oval: 2, square: 1, oblong: 1, heart: 1, diamond: 0 },
    ask: "Moustache joined to a chin beard in a circle around the mouth, with clean cheeks and neck.", tips: ["Neat and low-maintenance on thin cheeks."], illus: { kind: "circle", length: 0.5 } },
  { id: "chin-strap", name: "Chin strap", patchyOK: false, maintenance: 3, trimDays: 4, faces: { heart: 1, oval: 1, square: 2, round: 0, oblong: -1, diamond: 0 },
    ask: "A thin, sharp line of hair that follows the jaw from sideburn to sideburn, about 1 cm thick, with clean skin above and below.", tips: ["Defines the jaw but needs a very precise outline."], avoid: "Skip on an oblong face — it accentuates length.", illus: { kind: "strap", length: 0.25 } },
];

/* ------------------------------------------------------------------ glasses */

export type FrameStyle = {
  id: string; name: string; bold: 1 | 2 | 3;   // how much presence the frame has
  faces: Fit; why: Partial<Record<FaceShape, string>>;
  look: string;
};

export const FRAMES: FrameStyle[] = [
  { id: "round", name: "Round", bold: 2, faces: { square: 2, diamond: 1, heart: 1, oblong: 0, round: -1, oval: 1 }, why: { square: "Curves soften a strong jaw and angular features.", heart: "Soft curves balance a wider forehead.", round: "Round on round repeats the roundness — go angular instead." }, look: "Soft, creative, a little retro." },
  { id: "oval", name: "Oval", bold: 1, faces: { oval: 2, square: 2, diamond: 2, heart: 1, round: 0, oblong: 0 }, why: { square: "Gentle curves soften the jaw.", diamond: "Echoes your cheekbones without adding width there.", oval: "Matches your balanced proportions." }, look: "Easy and understated." },
  { id: "rectangular", name: "Rectangular", bold: 2, faces: { round: 2, oval: 1, heart: 1, square: -1, oblong: -1, diamond: 0 }, why: { round: "Angles add definition and make the face look longer.", square: "More angles on a square jaw can feel severe.", oblong: "A shallow rectangle shortens less than a deeper frame would." }, look: "Sharp and polished." },
  { id: "square", name: "Square", bold: 3, faces: { round: 2, oval: 1, oblong: 1, heart: 0, diamond: 0, square: -1 }, why: { round: "Strong lines add structure to a soft face.", oblong: "A deeper, squarer frame shortens a long face.", square: "Repeats the jaw's angles." }, look: "Confident and graphic." },
  { id: "aviator", name: "Aviator", bold: 2, faces: { heart: 2, oval: 2, square: 1, diamond: 0, round: 0, oblong: 0 }, why: { heart: "Wider at the top, narrower below, matching the face's proportions.", square: "The curved lower edge softens the jaw." }, look: "Classic, light, a bit rebellious." },
  { id: "cat-eye", name: "Cat-eye", bold: 2, faces: { diamond: 2, heart: 1, oval: 2, oblong: 1, round: 0, square: 0 }, why: { diamond: "Lifted outer corners highlight your cheekbones.", heart: "Draws attention outward and up." }, look: "Lifted, expressive." },
  { id: "browline", name: "Browline", bold: 3, faces: { oval: 1, diamond: 2, round: 1, square: 0, heart: -1, oblong: 0 }, why: { diamond: "Strong brow emphasis balances a narrow forehead.", heart: "A heavy top adds weight to an already wide forehead." }, look: "Intellectual, a little vintage." },
  { id: "geometric", name: "Geometric / hexagon", bold: 3, faces: { oval: 2, round: 1, oblong: 1, diamond: 0, heart: 1, square: -1 }, why: { oval: "Balanced faces can carry interesting shapes.", round: "Angles break up soft curves." }, look: "Fashion-forward." },
  { id: "panto", name: "Panto", bold: 2, faces: { round: 0, oval: 2, heart: 2, diamond: 1, square: 1, oblong: 0 }, why: { heart: "Wider at the bottom than a round frame, so it balances the jaw.", oval: "Flattering on almost any balanced face." }, look: "Warm and bookish." },
  { id: "rimless", name: "Rimless / thin wire", bold: 1, faces: { diamond: 2, oval: 2, heart: 2, round: 1, square: 1, oblong: 0 }, why: { diamond: "Light frames keep the focus on your cheekbones.", heart: "Light frames don't add weight at the forehead." }, look: "Barely there." },
  { id: "oversized", name: "Oversized", bold: 3, faces: { oblong: 2, oval: 1, diamond: 0, heart: 0, round: 0, square: 1 }, why: { oblong: "Deep, wide frames add width and break up a long face." }, look: "Glam and dramatic." },
];
