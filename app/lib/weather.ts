// Opt-in weather via Open-Meteo (free, no key). Only the coordinates you choose are sent.
export type Loc = { lat: number; lon: number; name: string };
export type Wx = { temp: number; hi: number; lo: number; rain: boolean; label: string };

const KEY = "capsule.location";

export function loadLoc(): Loc | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v && typeof v.lat === "number" && typeof v.lon === "number" ? v : null;
  } catch { return null; }
}
export function saveLoc(l: Loc | null) {
  try { l ? localStorage.setItem(KEY, JSON.stringify(l)) : localStorage.removeItem(KEY); } catch { /* private mode */ }
}

export async function geocode(q: string): Promise<Loc[]> {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`);
  if (!r.ok) throw new Error("Couldn't look up that place");
  const j = await r.json();
  return (j.results ?? []).map((x: { latitude: number; longitude: number; name: string; admin1?: string; country?: string }) => ({
    lat: x.latitude, lon: x.longitude, name: [x.name, x.admin1, x.country].filter(Boolean).join(", "),
  }));
}

export function deviceLocation(): Promise<Loc> {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("This browser can't share your location"));
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100, name: "My location" }),
      () => rej(new Error("Location permission was denied")),
      { timeout: 10000, maximumAge: 3600_000 },
    );
  });
}

const RAIN = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const SNOW = new Set([71, 73, 75, 77, 85, 86]);
function label(code: number) {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (RAIN.has(code)) return "Rain";
  if (SNOW.has(code)) return "Snow";
  return "Cloudy";
}

/** Forecast for a day (default today). Rounded, with a rain flag. */
export async function forecast(loc: Loc, date?: string): Promise<Wx> {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=8`;
  const r = await fetch(u);
  if (!r.ok) throw new Error("Weather is unavailable right now");
  const j = await r.json();
  const days: string[] = j.daily.time;
  let i = date ? days.indexOf(date) : 0;
  if (i < 0) i = 0;
  const hi = j.daily.temperature_2m_max[i], lo = j.daily.temperature_2m_min[i];
  const code = i === 0 ? j.current.weather_code : j.daily.weather_code[i];
  const temp = i === 0 ? j.current.temperature_2m : (hi + lo) / 2;
  const rain = (j.daily.precipitation_probability_max[i] ?? 0) >= 50 || RAIN.has(code);
  return { temp: Math.round(temp), hi: Math.round(hi), lo: Math.round(lo), rain, label: label(code) };
}
