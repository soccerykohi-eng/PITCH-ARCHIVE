import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app=await readFile(new URL("../app/archive-app.tsx",import.meta.url),"utf8");
const styles=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");

test("keeps collection root focused on cards and filters",()=>{
  assert.match(app,/コレクション/);assert.match(app,/種類 · \{totalCardCount\}枚/);assert.match(app,/placeholder="選手名・クラブ・シリーズで検索"/);assert.match(app,/重複のみ/);
  assert.doesNotMatch(app,/\$\{duplicateCardCount\}枚の重複/);
});

test("does not render collection rewards",()=>{
  assert.doesNotMatch(app,/CollectionMilestones/);assert.doesNotMatch(app,/\/api\/collection-milestones/);assert.doesNotMatch(app,/COLLECTION REWARDS/);
});

test("preserves the native filtered card viewer",()=>{
  assert.match(app,/openCard\(card, visibleCollection\)/);assert.match(app,/CollectionCardViewer/);assert.match(styles,/collection-viewer-info p/);assert.match(styles,/collection-tools\{top:0/);
});
