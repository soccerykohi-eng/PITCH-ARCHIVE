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

test("shared Google login routes the linked identity to the admin session",async()=>{
  const shared=await read("app/api/auth/google/callback/route.ts");
  const admin=await read("app/api/admin/auth/google/callback/route.ts");
  assert.match(shared,/admin_google_identities/);
  assert.match(shared,/createAdminSessionToken/);
  assert.match(shared,/ADMIN_SESSION_COOKIE/);
  assert.match(shared,/共通Googleログインから運営ログイン/);
  assert.match(admin,/admin_google_identities/);
});

test("legacy admin login URL returns to the shared login",async()=>{
  const page=await read("app/admin-login/page.tsx");
  assert.match(page,/redirect\("\/"\)/);
  assert.doesNotMatch(page,/ADMIN_ACCESS_KEY|admin-login-form|Googleで本人確認/);
});
