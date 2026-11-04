"use client";
import { useEffect, useState } from "react";
import { api, type Settings } from "@/lib/api";
import { SecretKey } from "./ui";
import { useStore } from "./store";

type Which = "gemini" | "openai";
const NAME: Record<Which, string> = { gemini: "Gemini", openai: "OpenAI" };

/** An AI key field (Gemini or OpenAI): hidden once saved, with Edit key and Remove. Used on the Me tab and wherever AI is needed. */
export function AiKeyField({ which, onChange }: { which: Which; onChange?: (s: Settings) => void }) {
  const { toast } = useStore();
  const [st, setSt] = useState<Settings | null>(null);
  useEffect(() => { api.settings().then(setSt).catch(() => {}); }, []);
  if (!st) return null;
  const fromEnv = which === "gemini" ? st.geminiFromEnv : st.openaiFromEnv;
  if (fromEnv) return <div className="xs muted">{NAME[which]} key is set by the {which === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"} environment variable.</div>;
  const field = which === "gemini" ? "geminiKey" : "openaiKey";
  const refresh = async () => { const s = await api.settings(); setSt(s); onChange?.(s); };
  return (
    <SecretKey
      isSet={which === "gemini" ? st.hasGemini : st.hasOpenai}
      placeholder={`Paste your ${NAME[which]} API key`}
      noun={`${NAME[which]} key`}
      onSave={async (v) => { await api.saveSettings({ [field]: v }); await refresh(); toast("Key saved on this computer"); }}
      onRemove={async () => { await api.saveSettings({ [field]: "" }); await refresh(); toast("Key removed"); }}
    />
  );
}

/** Kept for the screens that only need the Gemini field. */
export const GeminiKeyField = ({ onChange }: { onChange?: (saved: boolean) => void }) => <AiKeyField which="gemini" onChange={(s) => onChange?.(s.aiAvailable)} />;
