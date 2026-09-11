import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/session.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const sessions = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const guestId = "550e8400-e29b-41d4-a716-446655440000";
const secret = "test-session-secret";
const now = Date.UTC(2026, 0, 1);

test("accepts an unchanged guest session and rejects tampering", async () => {
  const token = await sessions.createGuestSessionToken(guestId, secret, now);
  assert.equal(await sessions.verifyGuestSessionToken(token, secret, now), guestId);
  assert.equal(await sessions.verifyGuestSessionToken(token.replace(guestId, crypto.randomUUID()), secret, now), null);
  assert.equal(await sessions.verifyGuestSessionToken(token, "wrong-secret", now), null);
});

test("rejects expired sessions and keeps admin sessions separate", async () => {
  const guestToken = await sessions.createGuestSessionToken(guestId, secret, now);
  assert.equal(await sessions.verifyGuestSessionToken(guestToken, secret, now + (366 * 24 * 60 * 60 * 1000)), null);
  const adminToken = await sessions.createAdminSessionToken(secret, now);
  assert.equal(await sessions.verifyAdminSessionToken(adminToken, secret, now), true);
  assert.equal(await sessions.verifyGuestSessionToken(adminToken, secret, now), null);
});

test("creates secure production cookies without storing access keys", async () => {
  const token = await sessions.createAdminSessionToken(secret, now);
  const cookie = sessions.sessionCookie(sessions.ADMIN_SESSION_COOKIE, token, sessions.ADMIN_SESSION_MAX_AGE, true);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Secure/);
  assert.doesNotMatch(cookie, new RegExp(secret));
});
