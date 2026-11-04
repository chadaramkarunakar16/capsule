import { EMPTY_BODY, type Body, type Measurements } from "./body";
import type { QuizAnswers } from "./analysis";
import type { FaceShape } from "./face";
import type { Density, HairType } from "../grooming/catalog";

export const AIMS = [
  "Balance shoulders and hips",
  "Look taller / lengthen legs",
  "Define my waist",
  "Add structure",
  "Keep it relaxed and easy",
  "No particular goal",
] as const;
export type Aim = (typeof AIMS)[number];

export type HairStyle = "short" | "medium" | "long" | "bun" | "none";
export type AvatarSettings = {
  skin: string | null;        // hex; from your colour photos when available, otherwise chosen by you
  hair: string | null;
  hairStyle: HairStyle;
  /** −1 slimmer … +1 broader. null = work it out from height and weight (or average) */
  build: number | null;
  shoulders: number;          // −1 … +1 fine-tuning, relative to the proportions in your profile
  hips: number;
  legs: number;
  waist: number;
};

export type SavedStyle = { kind: "hair" | "beard" | "glasses"; id: string; note?: string; refImage?: string };
export type Grooming = {
  hairType: HairType | null;
  density: Density | null;
  receding: boolean;
  length: "short" | "medium" | "long" | null;      // current length
  maintenance: 1 | 2 | 3 | null;                   // how much effort you want to put in
  facialHair: boolean;                             // show beard / moustache ideas at all
  beardGrowth: "patchy" | "full" | null;
  saved: SavedStyle[];
};
export const EMPTY_GROOMING: Grooming = { hairType: null, density: null, receding: false, length: null, maintenance: null, facialHair: false, beardGrowth: null, saved: [] };

export type Profile = {
  basics: {
    height: number | null;   // cm
    weight: number | null;   // kg — stored for the avatar (Phase 5); never used to score clothes
    direction: "Menswear" | "Womenswear" | "Mixed" | "Androgynous" | "";
    fit: "Tailored" | "Relaxed" | "Mix of both" | "";
    aims: Aim[];
    goals: string[];
  };
  measurements: Measurements;
  body: Body;
  color: {
    season: string | null;          // the season in use (auto or overridden)
    auto: { key: string; confidence: number; alternatives: { key: string; name: string }[] } | null;
    overridden: boolean;
    photos: number;
    quiz: QuizAnswers;
  };
  face: {
    shape: FaceShape | null;
    auto: { shape: FaceShape; confidence: number; alternatives: FaceShape[] } | null;
    overridden: boolean;
    wearsGlasses: boolean;
  };
  avatar: AvatarSettings;
  grooming: Grooming;
  updatedAt?: string;
};

export const EMPTY_PROFILE: Profile = {
  basics: { height: null, weight: null, direction: "", fit: "", aims: [], goals: [] },
  measurements: {},
  body: EMPTY_BODY,
  color: { season: null, auto: null, overridden: false, photos: 0, quiz: {} },
  face: { shape: null, auto: null, overridden: false, wearsGlasses: false },
  avatar: { skin: null, hair: null, hairStyle: "short", build: null, shoulders: 0, hips: 0, legs: 0, waist: 0 },
  grooming: EMPTY_GROOMING,
};

/** Fill in any missing branches so older/partial saves never crash the UI. */
export function normalizeProfile(p: Partial<Profile> | null | undefined): Profile {
  const e = EMPTY_PROFILE;
  return {
    ...e,
    ...p,
    basics: { ...e.basics, ...p?.basics },
    measurements: { ...p?.measurements },
    body: { ...e.body, ...p?.body },
    color: { ...e.color, ...p?.color, quiz: { ...p?.color?.quiz } },
    face: { ...e.face, ...p?.face },
    avatar: { ...e.avatar, ...p?.avatar },
    grooming: { ...EMPTY_GROOMING, ...p?.grooming, saved: [...(p?.grooming?.saved ?? [])] },
  };
}

export type SectionStatus = { basics: boolean; body: boolean; color: boolean; face: boolean };
export function status(p: Profile): SectionStatus {
  return {
    basics: !!(p.basics.height || p.basics.fit || p.basics.aims.length),
    body: !!(p.body.shoulderHip || p.body.torsoLeg || p.body.waist),
    color: !!p.color.season,
    face: !!p.face.shape,
  };
}
export const completion = (p: Profile) => Object.values(status(p)).filter(Boolean).length;
