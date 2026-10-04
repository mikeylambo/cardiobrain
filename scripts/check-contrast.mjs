// WCAG contrast check for every text/background pair the design uses.
// Run: node scripts/check-contrast.mjs   (fails the build if any pair misses its floor)
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const token = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --${name} not found in styles.css`);
  return m[1];
};

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const white = "#FFFFFF";
const ink = token("asphalt");
const chalk = token("chalk");
// [label, foreground, background, minimum] — 4.5 for body text, 3 for large display type and UI shapes.
const pairs = [
  ["Walk text on Lagoon", white, token("lagoon"), 4.5],
  ["Bike text on Signal", ink, token("signal"), 4.5],
  ["Stairs text on Ultraviolet", white, token("ultraviolet"), 4.5],
  ["Run text on Vermilion", ink, token("vermilion"), 4.5],
  ["Tile text (Asphalt on Chalk)", ink, chalk, 4.5],
  ["Pressed tile (Chalk on Asphalt)", chalk, ink, 4.5],
  ["Chalk tile against Lagoon field", chalk, token("lagoon"), 3],
  ["Tile edge (Asphalt) against Signal field", ink, token("signal"), 3],
  ["Chalk tile against Ultraviolet field", chalk, token("ultraviolet"), 3],
  ["Chalk tile against Vermilion field", chalk, token("vermilion"), 3],
  ["Muted text on Chalk", token("muted"), chalk, 4.5],
  ["Primary button (Asphalt) on Signal", ink, token("signal"), 3],
  ["Primary button (Asphalt) on Vermilion", ink, token("vermilion"), 3],
  ["Primary button (Chalk) on Lagoon", chalk, token("lagoon"), 3],
  ["Primary button (Chalk) on Ultraviolet", chalk, token("ultraviolet"), 3],
  ["Chart line (Asphalt) on Chalk", ink, chalk, 3],
  ["Seated: text on Chalk field", ink, chalk, 4.5],
  ["Seated: tile edge (Asphalt) on Chalk", ink, chalk, 3],
  ["Dark: Walk tint on Asphalt", token("lagoon-dark"), ink, 4.5],
  ["Dark: Bike on Asphalt", token("signal"), ink, 4.5],
  ["Dark: Stairs tint on Asphalt", token("ultraviolet-dark"), ink, 4.5],
  ["Dark: Run tint on Asphalt", token("vermilion-dark"), ink, 4.5],
  ["Dark: coach line (Asphalt on Stairs tint)", ink, token("ultraviolet-dark"), 4.5],
];

let failed = 0;
for (const [label, fg, bg, min] of pairs) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(`${ok ? "pass" : "FAIL"}  ${r.toFixed(2).padStart(5)}:1  (min ${min})  ${label}  ${fg} on ${bg}`);
}
if (failed) {
  console.error(`\n${failed} contrast pair(s) below AA.`);
  process.exit(1);
}
