// Passphrase-encrypted backups (AES-256-GCM, key from PBKDF2-SHA256). Runs in the browser; nothing is sent anywhere.
const ITER = 250_000;
const enc = new TextEncoder(), dec = new TextDecoder();

const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function key(pass: string, salt: Uint8Array, iter: number) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt as BufferSource, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export type Sealed = { app: "capsule-backup"; v: 1; kdf: "PBKDF2-SHA256"; iter: number; salt: string; iv: string; data: string };

export async function seal(plain: string, pass: string, iter = ITER): Promise<Sealed> {
  if (pass.length < 8) throw new Error("Use a passphrase of at least 8 characters");
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(pass, salt, iter), enc.encode(plain)));
  return { app: "capsule-backup", v: 1, kdf: "PBKDF2-SHA256", iter, salt: b64(salt), iv: b64(iv), data: b64(ct) };
}

export async function open(box: unknown, pass: string): Promise<string> {
  const b = box as Sealed;
  if (!b || b.app !== "capsule-backup" || b.v !== 1) throw new Error("This isn’t a Capsule encrypted backup");
  if (!Number.isInteger(b.iter) || b.iter < 10_000 || b.iter > 5_000_000) throw new Error("Unsupported backup settings");
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(b.iv) as BufferSource }, await key(pass, unb64(b.salt), b.iter), unb64(b.data) as BufferSource);
    return dec.decode(pt);
  } catch { throw new Error("Wrong passphrase, or the file is damaged"); }
}
