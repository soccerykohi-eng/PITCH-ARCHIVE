import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app=await readFile(new URL("../app/archive-app.tsx",import.meta.url),"utf8");
const nav=await readFile(new URL("../app/components/app/bottom-navigation.tsx",import.meta.url),"utf8");
const provider=await readFile(new URL("../app/components/app/app-data-provider.tsx",import.meta.url),"utf8");
const playerLayout=await readFile(new URL("../app/(player)/layout.tsx",import.meta.url),"utf8");

test("exposes real root and standalone utility routes",async()=>{
  for(const route of ["packs","collection","friends","friends/requests","friends/trades","menu"]){
    const page=await readFile(new URL(`../app/(player)/${route}/page.tsx`,import.meta.url),"utf8");
    assert.match(page,/ArchiveRoutePage/);
  }
  for(const route of ["notifications","exchange","settings","settings/safety"]){
    const page=await readFile(new URL(`../app/(player)/${route}/page.tsx`,import.meta.url),"utf8");
    assert.doesNotMatch(page,/ArchiveRoutePage|ArchiveApp|DialogContent|Portal/);
    assert.match(page,/PageClient/);
  }
  for(const view of ["notifications-page-client","exchange-page-client","settings-page-client","safety-page-client"]){
    const source=await readFile(new URL(`../app/components/${view}.tsx`,import.meta.url),"utf8");
    assert.doesNotMatch(source,/Dialog|DialogContent|Portal|position:\s*fixed/);
    assert.match(source,/className="route-page"/);
  }
  for(const path of ["/packs","/collection","/friends","/menu"]){
    assert.match(nav,new RegExp(path.replaceAll("/","\\/")));
  }
  assert.match(playerLayout,/AppDataProvider/);
  assert.match(playerLayout,/initialDashboard=\{dashboard\}/);
  assert.match(playerLayout,/BottomNavigation/);
  assert.match(provider,/refreshDashboard/);
  assert.doesNotMatch(`${app}\n${nav}`,/window\.location\.assign|location\.href/);
  assert.doesNotMatch(app,/アーカイブを読み込んでいます/);
  for(const removed of ["initialRoute","notificationsOpen","settingsOpen","safetyOpen"])assert.doesNotMatch(app,new RegExp(removed));
});
