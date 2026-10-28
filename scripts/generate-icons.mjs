/**
 * Regenerate Inkling's install icons from the canonical vector artwork.
 * Requires an existing Sharp installation; no fonts or remote assets are used.
 * Run: node scripts/generate-icons.mjs
 * If Sharp is installed outside this project, set INKLING_SHARP_PATH to its
 * absolute module entry point. Output is deterministic for a given Sharp version.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const { default: sharp } = await import(process.env.INKLING_SHARP_PATH || "sharp");
const icons = new URL("../public/icons/", import.meta.url);
const source = await readFile(new URL("inkling.svg", icons), "utf8");
const artwork = source.match(/<g id="inkling-mark">([\s\S]*?)<\/g>/)?.[1];
if (!artwork) throw new Error("The canonical Inkling SVG is missing its artwork group.");

// Keep the old SVG URL as a compatibility alias for installed apps and bookmarks.
await writeFile(new URL("lemnota.svg", icons), source);

for (const size of [192, 512]) {
  await sharp(Buffer.from(source), { density: 384 })
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(`icon-${size}.png`, icons)));
}

// Apple touch icons use an opaque square; iOS supplies the final corner mask.
const apple = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#F6F1E8"/>${artwork}</svg>`;
await sharp(Buffer.from(apple), { density: 384 })
  .resize(180, 180)
  .flatten({ background: "#F6F1E8" })
  .png()
  .toFile(fileURLToPath(new URL("apple-touch-icon.png", icons)));

// Scale the complete mark to 80%, keeping it inside Android's central safe zone.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#F6F1E8"/><g transform="translate(51.2 51.2) scale(.8)">${artwork}</g></svg>`;
await sharp(Buffer.from(maskable), { density: 384 })
  .resize(512, 512)
  .png()
  .toFile(fileURLToPath(new URL("icon-maskable-512.png", icons)));
