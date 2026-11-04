// Reading a person's photos is done by the AI service the person chose (Gemini or OpenAI): no model runs on this computer.
// The photo is shrunk, sent for this one question, and not stored (unless the person keeps it as their avatar).
import { api, type BodyAnalysis, type FaceAnalysis } from "./api";
import { toJpegDataUri } from "./image";
import type { PhotoSamples } from "./style/analysis";
import { hexToRgb } from "./style/color";

export type FaceRead = Extract<FaceAnalysis, { ok: true }>;
export type BodyRead = Extract<BodyAnalysis, { ok: true }>;
export type Failed = { ok: false; reason: string };

const NO_KEY = "Add an AI key in Me → AI first (Gemini or OpenAI). Photos are read by that service, never by a model on this computer.";

export async function analyseFacePhoto(file: Blob): Promise<FaceRead | Failed> {
  const r = await api.analyse({ kind: "face", image: await toJpegDataUri(file, 1024) });
  if (!("ok" in r)) return { ok: false, reason: NO_KEY };
  return r as FaceRead | Failed;
}

export async function analyseBodyPhoto(file: Blob): Promise<BodyRead | Failed> {
  const r = await api.analyse({ kind: "body", image: await toJpegDataUri(file, 1280) });
  if (!("ok" in r)) return { ok: false, reason: NO_KEY };
  return r as BodyRead | Failed;
}

/** The colours the AI read, shaped for the existing colour-season maths (which stays plain code). */
export function samplesOf(f: FaceRead): PhotoSamples {
  const rgb = (h: string | null) => (h ? [hexToRgb(h)] : null);
  return {
    skin: [hexToRgb(f.skin), hexToRgb(f.skin), hexToRgb(f.skin)],
    hair: rgb(f.hair),
    eyes: rgb(f.eyes),
    // lighting the AI judged poor counts against how much the reading is trusted
    castChroma: f.lighting === "good" ? 3 : f.lighting === "ok" ? 8 : 18,
    exposure: f.lighting === "poor" ? 60 : 140,
  };
}
