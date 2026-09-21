import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app=await readFile(new URL("../app/archive-app.tsx",import.meta.url),"utf8");

test("exposes real root and standalone utility routes",async()=>{
  for(const route of ["packs","collection","friends","friends/requests","friends/trades","menu"]){
    const page=await readFile(new URL(`../app/${route}/page.tsx`,import.meta.url),"utf8");
    assert.match(page,/ArchiveRoutePage/);
  }
  for(const route of ["notifications","exchange","settings","settings/safety"]){
    const page=await readFile(new URL(`../app/${route}/page.tsx`,import.meta.url),"utf8");
    assert.doesNotMatch(page,/ArchiveRoutePage|ArchiveApp|DialogContent|Portal/);
    assert.match(page,/PageClient/);
  }
  for(const view of ["notifications-page-client","exchange-page-client","settings-page-client","safety-page-client"]){
    const source=await readFile(new URL(`../app/components/${view}.tsx`,import.meta.url),"utf8");
    assert.doesNotMatch(source,/Dialog|DialogContent|Portal|position:\s*fixed/);
    assert.match(source,/className="route-page"/);
  }
  for(const path of ["/packs","/collection","/friends","/menu","/notifications","/exchange","/settings","/settings/safety"]){
    assert.match(app,new RegExp(path.replaceAll("/","\\/")));
  }
  assert.match(app,/onValueChange=\{\(value\) => window\.location\.assign/);
  for(const removed of ["initialRoute","notificationsOpen","settingsOpen","safetyOpen"])assert.doesNotMatch(app,new RegExp(removed));
});
