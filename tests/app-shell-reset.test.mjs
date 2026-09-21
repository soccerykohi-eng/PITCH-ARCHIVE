import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app=await readFile(new URL("../app/archive-app.tsx",import.meta.url),"utf8");
const styles=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");

test("removes the shared brand header from the root app shell",()=>{
  assert.doesNotMatch(app,/<header className="network-header">/);
  assert.doesNotMatch(app,/DIGITAL FOOTBALL CARDS/);
  assert.doesNotMatch(app,/className="collection-pill"/);
});

test("keeps exactly four player root navigation destinations",()=>{
  const nav=app.slice(app.indexOf('<TabsList className="network-nav">'),app.indexOf("</TabsList>",app.indexOf('<TabsList className="network-nav">')));
  assert.equal((nav.match(/<TabsTrigger/g)??[]).length,4);
  for(const value of ["packs","collection","social","menu"])assert.match(nav,new RegExp(`value="${value}"`));
});

test("hides root navigation throughout detail flows",()=>{
  for(const state of ["socialSubpageOpen","viewingPack","selectedCard","claim"])assert.match(app,new RegExp(state));
  for(const removed of ["safetyOpen","settingsOpen","notificationsOpen","initialRoute"])assert.doesNotMatch(app,new RegExp(removed));
  assert.match(styles,/has-native-subpage \.network-nav\{display:none/);
  assert.match(styles,/safe-area-inset-top/);
});
