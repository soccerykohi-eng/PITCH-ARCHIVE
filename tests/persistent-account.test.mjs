import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path,import.meta.url),"utf8");
const [page,gateway,start,registerOptions,registerVerify,loginOptions,loginVerify,settings,migration,pkg,session]=await Promise.all([
  read("../app/page.tsx"),read("../app/account-gateway.tsx"),read("../app/api/session/start/route.ts"),
  read("../app/api/passkey/register/options/route.ts"),read("../app/api/passkey/register/verify/route.ts"),
  read("../app/api/passkey/login/options/route.ts"),read("../app/api/passkey/login/verify/route.ts"),
  read("../app/archive-app.tsx"),read("../drizzle/0018_cheerful_jubilee.sql"),read("../package.json"),read("../app/session.ts"),
]);

test("shows an account gateway without creating a user on page access", () => {
  assert.match(page,/if \(!member\) return <AccountGateway/);
  assert.doesNotMatch(page,/redirect\("\/api\/session\/start"\)/);
  assert.match(gateway,/パスキーで続ける/);
  assert.match(gateway,/新しくはじめる/);
  assert.match(start,/export async function POST/);
  assert.doesNotMatch(start,/export async function GET/);
  assert.match(gateway,/disabled=\{busy !== null\}/);
});

test("registers discoverable verified credentials for the current player", () => {
  assert.match(registerOptions,/residentKey:"required"/);
  assert.match(registerOptions,/userVerification:"required"/);
  assert.match(registerOptions,/excludeCredentials/);
  assert.match(registerVerify,/verifyRegistrationResponse/);
  assert.match(registerVerify,/expectedOrigin:rp\.origin/);
  assert.match(registerVerify,/expectedRPID:rp\.rpID/);
  assert.match(registerVerify,/requireUserVerification:true/);
  assert.match(settings,/パスキーを設定/);
});

test("uses username-less server-verified authentication to restore the same user", () => {
  assert.match(loginOptions,/generateAuthenticationOptions\(\{ rpID:rp\.rpID,userVerification:"required" \}\)/);
  assert.doesNotMatch(loginOptions,/allowCredentials/);
  assert.match(loginVerify,/WHERE credential_id = \?/);
  assert.match(loginVerify,/verifyAuthenticationResponse/);
  assert.match(loginVerify,/UPDATE passkey_credentials SET counter = \?, last_used_at = \?/);
  assert.match(loginVerify,/createGuestSessionToken\(guestId,secret\)/);
  assert.doesNotMatch(loginVerify,/INSERT INTO users/);
});

test("stores only public credential material and uses a five-minute signed challenge", () => {
  assert.match(migration,/CREATE TABLE `passkey_credentials`/);
  assert.match(migration,/`public_key` text NOT NULL/);
  assert.doesNotMatch(migration,/private_key/);
  assert.match(session,/WEBAUTHN_CHALLENGE_MAX_AGE = 5 \* 60/);
  assert.match(session,/HttpOnly/);
  const dependencies=JSON.parse(pkg).dependencies;
  assert.ok(dependencies["@simplewebauthn/server"]);
  assert.ok(dependencies["@simplewebauthn/browser"]);
});
