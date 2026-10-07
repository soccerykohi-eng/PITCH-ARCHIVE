import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("native-style subpages use the shared large back button",async()=>{
  const [component,archive,collection,social,settings,opening,css]=await Promise.all([
    read("app/components/native-back-button.tsx"),
    read("app/archive-app.tsx"),
    read("app/components/collection-card-viewer.tsx"),
    read("app/social-panel.tsx"),
    read("app/components/settings-page-client.tsx"),
    read("app/components/pack-opening-experience.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(component,/native-back-button/);
  for(const source of [archive,collection,social,settings,opening]) assert.match(source,/NativeBackButton/);
  assert.match(css,/\.native-back-button\{[^}]*min-height:56px/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(collection,/collection-viewer-back/);
  assert.doesNotMatch(opening,/pack-opening-close/);
});

test("pack opening only exposes back before opening begins",async()=>{
  const source=await read("app/components/pack-opening-experience.tsx");
  assert.match(source,/phase === "opening"[\s\S]*?<NativeBackButton onClick=\{close\}/);
  assert.match(source,/if \(phase === "opening"\) return/);
});
