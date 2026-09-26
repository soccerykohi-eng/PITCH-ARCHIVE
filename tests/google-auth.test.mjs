import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(path) => readFile(new URL(path,import.meta.url),"utf8");
const [gateway,start,oauthStart,callback,create,status,google,settings,schema,migration,pkg,adminSession]=await Promise.all([
  read("../app/account-gateway.tsx"),read("../app/api/session/start/route.ts"),read("../app/api/auth/google/start/route.ts"),read("../app/api/auth/google/callback/route.ts"),read("../app/api/auth/google/create/route.ts"),read("../app/api/auth/google/status/route.ts"),read("../app/google-auth.ts"),read("../app/archive-app.tsx"),read("../db/schema.ts"),read("../drizzle/0020_secret_satana.sql"),read("../package.json"),read("../app/api/admin/session/route.ts"),
]);

test("replaces player passkeys with Google login and explicit account creation", () => {
  assert.match(gateway,/Googleで続ける/);assert.doesNotMatch(gateway,/パスキー/);
  assert.match(start,/status:410/);assert.doesNotMatch(start,/randomUUID/);
  assert.match(callback,/google-pending/);assert.doesNotMatch(callback,/INSERT INTO users/);
  assert.match(create,/crypto\.randomUUID/);assert.match(create,/INSERT INTO users/);
});

test("uses authorization code PKCE with signed state and fixed callbacks", () => {
  assert.match(google,/code_challenge_method:"S256"/);assert.match(google,/response_type:"code"/);
  assert.match(google,/scope:"openid email profile"/);assert.match(callback,/flow\.state !== state/);
  assert.match(google,/https:\/\/oauth2\.googleapis\.com\/token/);assert.match(google,/client_secret:client\.clientSecret/);
  assert.match(google,/pitch-archive\.soccerykohi\.workers\.dev\/api\/auth\/google\/callback/);
});

test("links and restores players by Google sub without changing player data", () => {
  assert.match(schema,/googleSub: text\("google_sub"\)\.primaryKey/);assert.match(schema,/userEmail: text\("user_email"\)\.notNull\(\)\.unique/);
  assert.match(migration,/CREATE TABLE `google_identities`/);assert.match(callback,/WHERE google_sub=\?/);
  assert.match(callback,/createGuestSessionToken\(guestId/);assert.doesNotMatch(callback,/role='admin'|role = 'admin'/);
  assert.match(status,/WHERE user_email=\?/);assert.match(settings,/Googleアカウントを連携/);
  assert.match(adminSession,/createAdminSessionToken/);
});

test("uses the shared Google entry point for the linked admin identity", () => {
  assert.match(callback,/admin_google_identities/);assert.match(callback,/createAdminSessionToken/);assert.match(callback,/ADMIN_SESSION_COOKIE/);
});

test("removes SimpleWebAuthn runtime dependencies and does not store OAuth tokens", () => {
  const dependencies=JSON.parse(pkg).dependencies;
  assert.equal(dependencies["@simplewebauthn/server"],undefined);assert.equal(dependencies["@simplewebauthn/browser"],undefined);
  for (const source of [callback,create,status,schema]) assert.doesNotMatch(source,/access_token|refresh_token|id_token/);
  assert.match(oauthStart,/mode === "link"/);
});
