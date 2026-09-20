import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app=await readFile(new URL("../app/archive-app.tsx",import.meta.url),"utf8");

test("exposes real root and menu routes",async()=>{
  for(const route of ["packs","collection","friends","friends/requests","friends/trades","menu","notifications","exchange","settings","settings/safety"]){
    const page=await readFile(new URL(`../app/${route}/page.tsx`,import.meta.url),"utf8");
    assert.match(page,/ArchiveRoutePage/);
  }
  for(const path of ["/packs","/collection","/friends","/menu","/notifications","/exchange","/settings","/settings/safety"]){
    assert.match(app,new RegExp(path.replaceAll("/","\\/")));
  }
  assert.match(app,/onValueChange=\{\(value\) => window\.location\.assign/);
});
