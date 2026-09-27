import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app/archive-app.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const opening = await readFile(new URL("../app/components/pack-opening-experience.tsx", import.meta.url), "utf8");

test("presents packs with focused Japanese opening states", () => {
  assert.match(app, /CURRENT PACK/);
  assert.match(app, /firstOpen \? "初回無料" : "1回 100 COINS"/);
  assert.match(app, /firstOpen \? "無料でパックを開ける" : "100コインでパックを開ける"/);
  assert.match(app, /収録カードを見る/);
  assert.match(app, /<h1>\{packView === "active" \? "パック" : "過去パック"\}<\/h1>/);
});

test("fits the active mobile pack screen to the usable viewport", () => {
  assert.match(css, /network-shell:has\(\.network-page:not\(\.is-past-pack-view\) \.packs-heading\)/);
  assert.match(css, /height:100dvh;min-height:100svh;overflow:hidden/);
  assert.match(css, /padding-bottom:calc\(84px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /pack-view-content\[data-state="active"\][\s\S]*?flex:1/);
  assert.match(css, /pack-showcase[\s\S]*?flex:1 1 auto/);
  assert.match(css, /featured-pack-actions[\s\S]*?grid-template-columns:1\.25fr 1fr/);
});

test("makes the first draw free and charges 100 coins for repeat draws", async () => {
  const claim = await readFile(new URL("../app/api/packs/[id]/claim/route.ts", import.meta.url), "utf8");
  assert.match(claim, /const REOPEN_COST=100/);
  assert.match(claim, /const paid=\(count\?\.total \?\? 0\)>0/);
  assert.match(claim, /UPDATE users SET points=points-\?/);
  assert.match(claim, /points>=\?/);
  assert.match(claim, /INSERT INTO pack_claims/);
  assert.match(claim, /INSERT INTO pack_openings/);
  assert.match(claim, /quantity=collection\.quantity\+1/);
  assert.doesNotMatch(claim, /開封上限/);
  assert.match(opening, /pack\.openCount === 0 \? "無料で開封" : "100コインで開封"/);
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
