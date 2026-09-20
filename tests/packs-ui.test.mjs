import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app/archive-app.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const opening = await readFile(new URL("../app/components/pack-opening-experience.tsx", import.meta.url), "utf8");

test("presents packs with focused Japanese opening states", () => {
  assert.match(app, /CURRENT PACK/);
  assert.match(app, /あと1回開封できます/);
  assert.match(app, /`残り \$\{remaining\} \/ \$\{pack\.openLimit\}回`/);
  assert.match(app, /\? "開封済み" : "パックを開ける"/);
  assert.match(app, /収録カードを見る/);
  assert.match(app, /<h1>\{packView === "active" \? "パック" : "過去パック"\}<\/h1>/);
});

test("keeps pack claiming behavior in one native full-screen state machine", () => {
  assert.match(app, /<PackOpeningExperience/);
  assert.match(opening, /type PackOpeningPhase="ready" \| "opening" \| "reveal" \| "result" \| "error" \| "closing"/);
  assert.match(opening, /fetch\(`\/api\/packs\/\$\{pack\.id\}\/claim`/);
  assert.match(opening, /distance >= THRESHOLD/);
  assert.match(opening, /MIN_OPENING_MS=700/);
  assert.match(opening, /createPortal\(overlay,document\.body\)/);
  assert.match(css, /\.pack-opening-overlay \{ position:fixed;inset:0;[\s\S]*?height:100dvh/);
  assert.doesNotMatch(opening, /AlertDialog|DialogContent/);
});

test("uses a two-column catalog and restrained rarity result screens", () => {
  assert.match(app, /<span>\{pack\.cards\.length\} CARDS<\/span>/);
  assert.match(app, /<span className="drawn-label">所持<\/span>/);
  assert.match(css, /\.pack-catalog-grid \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.native-revealed-card img \{[\s\S]*?max-height:58dvh/);
  for (const rarity of ["rare", "elite", "icon"]) {
    assert.match(css, new RegExp(`\\.pack-opening-overlay\\.rarity-${rarity}`));
  }
  assert.match(opening, /\{resultCard\.rarity\} · \{resultCard\.series\}/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("removes pack opening modal hacks and only fades the fixed overlay when closing", () => {
  assert.doesNotMatch(app, /pack-open-dialog|draw-result-dialog|drawnCard|packSwipeDistance/);
  assert.doesNotMatch(css, /body:has\(\.pack-open-dialog\)/);
  assert.match(css, /\.pack-opening-overlay\.phase-closing \{ opacity:0;pointer-events:none; \}/);
  assert.match(opening, /document\.body\.style\.overflow="hidden"/);
  assert.match(opening, /document\.body\.style\.overflow=previous/);
});
