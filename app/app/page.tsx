"use client";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { AddSheet, ReviewQueue } from "./_ui/add";
import { BoardView } from "./_ui/boards";
import { ItemDetail } from "./_ui/detail";
import { LogWear } from "./_ui/log";
import { OutfitBuilder } from "./_ui/outfit";
import { PaletteView, StyleSetup } from "./_ui/style";
import { Customize } from "./_ui/stylist";
import { LookView, ShopLookSheet } from "./_ui/shop";
import { CapsuleScreen, FindPiece } from "./_ui/capsule";
import { AvatarEditor, Lineup, TryOnScreen } from "./_ui/avatar";
import { PhotoTryOn } from "./_ui/avatar-photo";
import { GroomingHome, StyleDetail } from "./_ui/grooming";
import { PrivacyCentre } from "./_ui/privacy";
import { GlassesPhoto } from "./_ui/grooming-photo";
import { StoreProvider, useStore, type Overlay as OverlayT } from "./_ui/store";
import { CapsuleTab, ClosetTab, MeTab, TodayTab } from "./_ui/tabs";
import { I, Overlay } from "./_ui/ui";

type Tab = "today" | "closet" | "capsule" | "me";

function renderOverlay(o: OverlayT, pop: () => void, key: number) {
  switch (o.t) {
    case "item": return <ItemDetail key={key} id={o.id} />;
    case "review": return <Overlay key={key} title="Review new items" onBack={pop}><ReviewQueue /></Overlay>;
    case "outfit": return <OutfitBuilder key={key} outfitId={o.outfitId} itemIds={o.itemIds} />;
    case "board": return <BoardView key={key} id={o.id} />;
    case "log": return <LogWear key={key} date={o.date} />;
    case "style": return <StyleSetup key={key} section={o.section} />;
    case "palette": return <PaletteView key={key} />;
    case "capsule": return <CapsuleScreen key={key} id={o.id} kind={o.kind} goal={o.goal} />;
    case "findpiece": return <FindPiece key={key} piece={o.piece} />;
    case "privacy": return <PrivacyCentre key={key} />;
    case "grooming": return <GroomingHome key={key} />;
    case "groomstyle": return <StyleDetail key={key} kind={o.kind} id={o.id} />;
    case "glassesphoto": return <GlassesPhoto key={key} frame={o.frame} />;
    case "avatar": return <AvatarEditor key={key} />;
    case "tryon": return <TryOnScreen key={key} itemIds={o.itemIds} name={o.name} />;
    case "lineup": return <Lineup key={key} looks={o.looks} title={o.title} />;
    case "phototryon": return <PhotoTryOn key={key} itemIds={o.itemIds} />;
    case "look": return <LookView key={key} id={o.id} />;
    case "customize": return <Customize key={key} itemIds={o.itemIds} name={o.name} occasionKey={o.occasionKey} target={o.target} weather={o.weather} />;
  }
}

function Shell() {
  const [tab, setTab] = useState<Tab>("today");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []); // dates/locale differ between server and browser
  const { stack, pop, push, sheet, setSheet, toastMsg, loaded } = useStore();
  // opened from "Share → Capsule": /?look=<id>
  useEffect(() => {
    if (!loaded) return;
    const id = new URLSearchParams(window.location.search).get("look");
    if (id) { window.history.replaceState(null, "", "/"); push({ t: "look", id }); }
    // hosted build: the service worker kept the shared picture, so store it in the on-device library
    if (new URLSearchParams(window.location.search).get("shared") === "1") {
      window.history.replaceState(null, "", "/");
      (async () => {
        try {
          const c = await caches.open("capsule-share");
          const img = await c.match("/__share/image");
          const meta = (await (await c.match("/__share/meta"))?.json().catch(() => null)) ?? { link: "", title: "" };
          if (!img) return;
          const blob = await img.blob();
          await c.delete("/__share/image");
          const up = await api.upload(blob);
          const look = await api.createLook({ image: up.image, sourceUrl: meta.link, note: meta.title });
          push({ t: "look", id: look.id });
        } catch { /* nothing shared */ }
      })();
    }
    // eslint-disable-next-line
  }, [loaded]);
  const tabs: [Tab, string, React.ReactNode][] = [["today", "Today", I.today], ["closet", "Closet", I.closet]];
  const tabs2: [Tab, string, React.ReactNode][] = [["capsule", "Capsule", I.capsule], ["me", "Me", I.me]];
  const btn = ([id, label, icon]: [Tab, string, React.ReactNode]) => (
    <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{icon}{label}</button>
  );
  if (!mounted) return <main className="app" />;
  return (
    <main className="app">
      {tab === "today" && <TodayTab />}
      {tab === "closet" && <ClosetTab />}
      {tab === "capsule" && <CapsuleTab />}
      {tab === "me" && <MeTab />}
      <nav className="nav">
        {tabs.map(btn)}
        <button aria-label="Add" onClick={() => setSheet("add")}><span className="plus">{I.plus}</span></button>
        {tabs2.map(btn)}
      </nav>
      {stack.map((o, i) => renderOverlay(o, pop, i))}
      {sheet === "add" && <AddSheet />}
      {sheet === "shop" && <ShopLookSheet onClose={() => setSheet(null)} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </main>
  );
}

export default function Page() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
