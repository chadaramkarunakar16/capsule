"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SecretKey } from "./ui";
import { useStore } from "./store";

/** The Gemini key field: hidden once saved, with Edit key and Remove. Used on the Me tab and wherever AI is needed. */
export function GeminiKeyField({ onChange }: { onChange?: (saved: boolean) => void }) {
  const { toast } = useStore();
  const [st, setSt] = useState<Awaited<ReturnType<typeof api.settings>> | null>(null);
  useEffect(() => { api.settings().then(setSt).catch(() => {}); }, []);
  if (!st) return null;
  if (st.geminiFromEnv) return <div className="xs muted">Key is set via the GEMINI_API_KEY environment variable.</div>;
  const refresh = async () => { const s = await api.settings(); setSt(s); onChange?.(!!s.geminiHint); };
  return (
    <SecretKey
      isSet={!!st.geminiHint}
      placeholder="Paste your Gemini API key"
      noun="Gemini key"
      onSave={async (v) => { await api.saveSettings({ geminiKey: v }); await refresh(); toast("Key saved on this computer"); }}
      onRemove={async () => { await api.saveSettings({ geminiKey: "" }); await refresh(); toast("Key removed"); }}
    />
  );
}
