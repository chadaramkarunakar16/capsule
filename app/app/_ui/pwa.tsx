"use client";
import { useEffect, useState } from "react";

/** Registers the service worker in production builds and shows a small banner while offline. */
export function Pwa() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online ? null : <div className="offline" role="status">Offline — showing what's saved on this device</div>;
}
