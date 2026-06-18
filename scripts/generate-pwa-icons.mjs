/**
 * Generate the PWA icon set from inline SVG sources.
 *
 * The mark is an ascending bar chart (growth / piloting) in the design
 * accent green (`#ade74e`) on the dark card background (`#131719`), matching
 * `src/app/globals.css` design tokens. Run with: `node scripts/generate-pwa-icons.mjs`.
 */
import { createRequire } from "node:module"
import { readdirSync } from "node:fs"
import { writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function loadSharp() {
  try {
    return require("sharp")
  } catch {
    const pnpmDir = join(root, "node_modules", ".pnpm")
    const entry = readdirSync(pnpmDir).find((d) => d.startsWith("sharp@"))
    if (!entry) throw new Error("sharp not found in node_modules/.pnpm")
    return require(join(pnpmDir, entry, "node_modules", "sharp"))
  }
}

const BG = "#131719"
const ACCENT = "#ade74e"

const BARS = [
  { x: 132, y: 302, h: 70, o: 0.55 },
  { x: 200, y: 252, h: 120, o: 0.7 },
  { x: 268, y: 197, h: 175, o: 0.85 },
  { x: 336, y: 142, h: 230, o: 1 },
]
  .map(
    (b) =>
      `<rect x="${b.x}" y="${b.y}" width="44" height="${b.h}" rx="12" fill="${ACCENT}" opacity="${b.o}"/>`,
  )
  .join("")

const roundedSvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" rx="112" fill="${BG}"/>${BARS}</svg>`
const squareSvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" fill="${BG}"/>${BARS}</svg>`

const iconsDir = join(root, "public", "icons")

async function main() {
  const sharp = loadSharp()
  const rounded = Buffer.from(roundedSvg)
  const square = Buffer.from(squareSvg)

  await sharp(rounded).resize(192, 192).png().toFile(join(iconsDir, "icon-192x192.png"))
  await sharp(rounded).resize(512, 512).png().toFile(join(iconsDir, "icon-512x512.png"))
  await sharp(square).resize(512, 512).png().toFile(join(iconsDir, "icon-512-maskable.png"))
  await sharp(square).resize(180, 180).png().toFile(join(iconsDir, "apple-touch-icon.png"))
  await writeFile(join(iconsDir, "icon.svg"), roundedSvg + "\n")

  console.log("Generated PWA icons in public/icons/")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
