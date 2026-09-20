import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [app,viewer,css]=await Promise.all([
  readFile(new URL("../app/archive-app.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/components/collection-card-viewer.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
]);

test("uses one collection tab without collection rewards",() => {
  assert.equal((app.match(/<TabsContent value="collection"/g) ?? []).length,1);
  assert.doesNotMatch(app,/CollectionMilestones/);
  assert.doesNotMatch(app,/\/api\/collection-milestones/);
});

test("keeps search, series, duplicate, and compound rarity filters with reset",() => {
  assert.match(app,/選手名・クラブ・シリーズで検索/);
  assert.match(app,/\["ALL","CORE","RARE","ELITE","ICON"\]/);
  assert.match(app,/すべてのシリーズ/);
  assert.match(app,/重複のみ/);
  assert.match(app,/絞り込みをリセット/);
  assert.match(app,/openCard\(card, visibleCollection\)/);
});

test("renders a stable responsive card grid and quantity badge",() => {
  assert.match(app,/duplicate-card-badge/);
  assert.match(app,/×\{card\.quantity\}/);
  assert.match(css,/\.collection-grid \.shared-card>img \{[^}]*aspect-ratio:5\/7;object-fit:contain/);
  assert.match(css,/@media \(max-width:767px\)[\s\S]*?\.collection-grid \{ gap:9px; \}/);
});

test("uses a native portal viewer with filtered paging, swipe, fade close, and scroll lock",() => {
  assert.match(app,/<CollectionCardViewer/);
  assert.match(viewer,/createPortal\(viewer,document\.body\)/);
  assert.match(viewer,/Math\.abs\(distance\) >= 50/);
  assert.match(viewer,/document\.body\.style\.overflow="hidden"/);
  assert.match(css,/\.collection-viewer \{ position:fixed;inset:0;/);
  assert.match(css,/\.collection-viewer\.is-closing \{ opacity:0;pointer-events:none; \}/);
  assert.match(css,/padding:calc\(env\(safe-area-inset-top\)/);
});
