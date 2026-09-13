import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../app/archive-app.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("presents packs with focused Japanese opening states", () => {
  assert.match(app, /CURRENT PACK/);
  assert.match(app, /あと1回開封できます/);
  assert.match(app, /`残り \$\{remaining\} \/ \$\{pack\.openLimit\}回`/);
  assert.match(app, /\? "開封済み" : "パックを開ける"/);
  assert.match(app, /収録カードを見る/);
  assert.match(app, /<h1>\{packView === "active" \? "パック" : "過去パック"\}<\/h1>/);
});

test("keeps pack claiming behavior while adding full-screen mobile presentation", () => {
  assert.match(app, /fetch\(`\/api\/packs\/\$\{claim\.id\}\/claim`/);
  assert.match(app, /const shouldOpen = distance >= 104/);
  assert.match(app, /onClick=\{confirmClaim\}/);
  assert.match(css, /\.pack-open-dialog \{[\s\S]*?width:100vw!important;[\s\S]*?height:100dvh!important;/);
  assert.match(css, /body:has\(\.pack-open-dialog\) \.network-nav/);
  assert.match(css, /\.pack-open-dialog\.is-opening \.pack-swipe-pack/);
});

test("uses a two-column catalog and restrained rarity result screens", () => {
  assert.match(app, /<span>\{pack\.cards\.length\} CARDS<\/span>/);
  assert.match(app, /<span className="drawn-label">所持<\/span>/);
  assert.match(css, /\.pack-catalog-grid \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.draw-result-dialog \{[\s\S]*?width:100vw!important;[\s\S]*?height:100dvh!important;/);
  for (const rarity of ["rare", "elite", "icon"]) {
    assert.match(css, new RegExp(`\\.draw-result-dialog\\.rarity-${rarity}`));
  }
  assert.match(app, /\{drawnCard\.rarity\} · \{drawnCard\.series\}/);
  assert.doesNotMatch(app, /className="reveal-stars"/);
});
