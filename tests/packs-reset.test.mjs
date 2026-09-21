import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app=await readFile(new URL("../app/archive-app.tsx",import.meta.url),"utf8");
const styles=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");

test("keeps packs focused on the current release",()=>{
  assert.match(app,/現在のパック/);assert.match(app,/残り \$\{remaining\} \/ \$\{pack\.openLimit\}回/);assert.match(app,/パックを開ける/);assert.match(app,/収録カードを見る/);
  assert.doesNotMatch(app,/PITCH ARCHIVE RELEASE/);
});

test("uses one card image as pack artwork without changing claim behavior",()=>{
  assert.match(app,/pack\.cards\.slice\(0, 1\)/);assert.match(app,/setClaim\(pack\)/);assert.match(app,/PackOpeningExperience/);
});

test("keeps the catalog as a native pack subpage",()=>{
  assert.match(app,/className="pack-catalog-page"/);assert.match(app,/>\s*パック\s*<\/button>/);assert.match(styles,/pack-catalog-header>div\{flex:1;min-width:0;justify-content:flex-start;text-align:left/);
});
