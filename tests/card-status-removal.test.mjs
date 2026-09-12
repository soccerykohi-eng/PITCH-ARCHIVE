import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("removes legacy card status fields from UI, types, and API output", async () => {
  const files = await Promise.all([
    "app/types.ts",
    "app/server-data.ts",
    "app/api/admin/cards/route.ts",
    "app/api/exchange/route.ts",
    "app/api/social/route.ts",
  ].map((path) => readFile(new URL(path, root), "utf8")));
  const [types, ...apiSources] = files;
  const sharedCard = types.match(/export type SharedCard = \{[\s\S]*?\n\};/)?.[0] ?? "";
  for (const field of ["number", "rating", "cardType", "season"]) {
    assert.doesNotMatch(sharedCard, new RegExp(`\\n\\s*${field}[?:]`));
  }
  for (const source of apiSources) {
    assert.doesNotMatch(source, /card_type AS cardType|c\.number|c\.rating|c\.season/);
  }

  const [app, library] = await Promise.all([
    readFile(new URL("app/archive-app.tsx", root), "utf8"),
    readFile(new URL("app/admin-card-library.tsx", root), "utf8"),
  ]);
  assert.doesNotMatch(app, /RATING|NUMBER|TYPEなし|SEASONなし|selectedCard\.(rating|number|cardType|season)/);
  assert.match(app, /jsonPreview\.rarity[\s\S]*jsonPreview\.series/);
  assert.doesNotMatch(library, /評価順|レーティング|背番号|カード種類|シーズン|card\.rating/);
});

test("accepts rarity directly and keeps legacy DB columns internal", async () => {
  const upload = await readFile(new URL("app/api/admin/packs/[id]/cards/route.ts", root), "utf8");
  assert.match(upload, /value\.rarity/);
  assert.doesNotMatch(upload, /value\.(rating|number|cardType|season)/);
  assert.doesNotMatch(upload, /RARITY_ALIASES/);
  assert.match(upload, /NULL,80/);
  assert.match(upload, /'LEGACY','—'/);
  assert.match(upload, /rarity=excluded\.rarity,series=excluded\.series/);
});
