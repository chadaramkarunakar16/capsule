// Renders build/logo.svg into every icon the app needs (PWA, browser tab, Windows .ico).
import fs from "node:fs";
import sharp from "sharp";

const svg = fs.readFileSync("build/logo.svg");
const png = (size, o = {}) => sharp(svg, { density: 384 }).resize(size, size).png(o).toBuffer();

// maskable icons keep the mark inside the central safe zone and fill the whole square
const maskable = async (size) => {
  const bg = await sharp({ create: { width: size, height: size, channels: 4, background: "#1b1a18" } }).png().toBuffer();
  const mark = await sharp(svg, { density: 384 }).resize(Math.round(size * 0.66), Math.round(size * 0.66)).png().toBuffer();
  return sharp(bg).composite([{ input: mark, gravity: "centre" }]).png().toBuffer();
};

// .ico with PNG-compressed images (supported since Windows Vista)
function ico(images) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const dirs = images.map(({ size, data }) => {
    const d = Buffer.alloc(16);
    d[0] = size >= 256 ? 0 : size; d[1] = size >= 256 ? 0 : size;
    d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6);
    d.writeUInt32LE(data.length, 8); d.writeUInt32LE(offset, 12);
    offset += data.length;
    return d;
  });
  return Buffer.concat([head, ...dirs, ...images.map((i) => i.data)]);
}

fs.mkdirSync("public/icons", { recursive: true });
fs.writeFileSync("public/icons/icon-192.png", await png(192));
fs.writeFileSync("public/icons/icon-512.png", await png(512));
fs.writeFileSync("public/icons/icon-maskable-512.png", await maskable(512));
fs.writeFileSync("public/icons/apple-touch-icon.png", await png(180));
fs.writeFileSync("build/icon.png", await png(512));
const sizes = [16, 24, 32, 48, 64, 128, 256];
const set = await Promise.all(sizes.map(async (size) => ({ size, data: await png(size) })));
fs.writeFileSync("build/icon.ico", ico(set));
fs.writeFileSync("app/favicon.ico", ico(set.filter((s) => s.size <= 48)));
console.log("icons written");
