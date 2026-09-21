import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app=await readFile(new URL("../app/archive-app.tsx",import.meta.url),"utf8");
const nav=await readFile(new URL("../app/components/app/bottom-navigation.tsx",import.meta.url),"utf8");
const playerLayout=await readFile(new URL("../app/(player)/layout.tsx",import.meta.url),"utf8");
const styles=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");

test("removes the shared brand header from the root app shell",()=>{
  assert.doesNotMatch(app,/<header className="network-header">/);
  assert.doesNotMatch(app,/DIGITAL FOOTBALL CARDS/);
  assert.doesNotMatch(app,/className="collection-pill"/);
});

test("keeps exactly four player root navigation destinations",()=>{
  assert.equal((nav.match(/href: "/g)??[]).length,4);
  for(const route of ["/packs","/collection","/friends","/menu"])assert.match(nav,new RegExp(`href: "${route}"`));
  assert.match(playerLayout,/<BottomNavigation \/>/);
});

test("keeps detail states separate from the persistent route navigation",()=>{
  for(const state of ["socialSubpageOpen","viewingPack","selectedCard","claim"])assert.match(app,new RegExp(state));
  for(const removed of ["safetyOpen","settingsOpen","notificationsOpen","initialRoute"])assert.doesNotMatch(app,new RegExp(removed));
  assert.doesNotMatch(app,/<TabsList className="network-nav">/);
  assert.match(styles,/safe-area-inset-top/);
});
