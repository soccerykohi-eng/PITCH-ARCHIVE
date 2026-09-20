import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const styles=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");

test("uses native system typography and readable mobile sizing",()=>{
  assert.match(styles,/SF Pro Text/);
  assert.match(styles,/font-size:clamp\(30px,8vw,34px\)/);
  assert.match(styles,/native-friend-row strong\{font-size:15px/);
});

test("reduces dashboard kickers and card-like social surfaces",()=>{
  assert.match(styles,/social-title \.section-kicker/);
  assert.match(styles,/social-section\{padding:18px 0;border:0;border-radius:0;background:transparent/);
  assert.match(styles,/menu-list>button\{min-height:64px;border:0;border-bottom/);
});

test("keeps the three formal surface and radius token levels",()=>{
  for(const token of ["--pa-surface-1","--pa-surface-2","--pa-surface-3","--pa-radius-sm","--pa-radius-md","--pa-radius-lg"])assert.match(styles,new RegExp(token));
});
