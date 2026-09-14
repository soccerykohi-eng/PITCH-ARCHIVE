import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("admin Google verification never creates an admin session",async()=>{
  const callback=await read("app/api/admin/auth/google/callback/route.ts");
  assert.match(callback,/admin-google-verified/);
  assert.doesNotMatch(callback,/createAdminSessionToken/);
  assert.match(callback,/admin\.google_verify/);
});

test("admin access remains key-only until the first Google link",async()=>{
  const route=await read("app/api/admin/session/route.ts");
  assert.match(route,/if \(linked\)/);
  assert.match(route,/ADMIN_GOOGLE_VERIFIED_COOKIE/);
  assert.match(route,/admin\.login/);
});

test("initial admin link requires an admin session and access key",async()=>{
  const route=await read("app/api/admin/auth/google/link/start/route.ts");
  assert.match(route,/requireAdmin\(\)/);
  assert.match(route,/secretsEqual/);
  assert.match(route,/admin-link/);
});

test("player and admin Google identities remain separate",async()=>{
  const player=await read("app/api/auth/google/callback/route.ts");
  const admin=await read("app/api/admin/auth/google/callback/route.ts");
  assert.doesNotMatch(player,/admin_google_identities/);
  assert.match(admin,/admin_google_identities/);
});
