const encoder = new TextEncoder();

export const GUEST_SESSION_COOKIE = "pa_session";
export const ADMIN_SESSION_COOKIE = "pa_admin_session";
export const GUEST_SESSION_MAX_AGE = 365 * 24 * 60 * 60;
export const ADMIN_SESSION_MAX_AGE = 12 * 60 * 60;

type SessionKind = "guest" | "admin";

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
    ),
  );
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function createToken(
  kind: SessionKind,
  subject: string,
  maxAge: number,
  secret: string,
  now = Date.now(),
) {
  if (!secret) throw new Error("Session secret is unavailable");
  const expiresAt = Math.floor(now / 1000) + maxAge;
  const payload = `${kind}.${subject}.${expiresAt}`;
  return `${payload}.${await hmac(payload, secret)}`;
}

async function verifyToken(
  token: string | undefined,
  kind: SessionKind,
  secret: string,
  now = Date.now(),
) {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== kind) return null;
  const [tokenKind, subject, rawExpiresAt, signature] = parts;
  const expiresAt = Number(rawExpiresAt);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000))
    return null;
  const payload = `${tokenKind}.${subject}.${rawExpiresAt}`;
  const expected = await hmac(payload, secret);
  return constantTimeEqual(signature, expected) ? subject : null;
}

export function guestPrincipal(guestId: string) {
  return `guest+${guestId}@pitcharchive.local`;
}

export function guestDisplayName(guestId: string) {
  return `PLAYER ${guestId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export function createGuestSessionToken(
  guestId: string,
  secret: string,
  now = Date.now(),
) {
  return createToken("guest", guestId, GUEST_SESSION_MAX_AGE, secret, now);
}

export async function verifyGuestSessionToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
) {
  const guestId = await verifyToken(token, "guest", secret, now);
  return guestId && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(guestId)
    ? guestId
    : null;
}

export function createAdminSessionToken(secret: string, now = Date.now()) {
  return createToken("admin", "admin", ADMIN_SESSION_MAX_AGE, secret, now);
}

export async function verifyAdminSessionToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
) {
  return (await verifyToken(token, "admin", secret, now)) === "admin";
}

export async function secretsEqual(left: string, right: string) {
  if (!left || !right) return false;
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  return constantTimeEqual(
    toBase64Url(new Uint8Array(leftHash)),
    toBase64Url(new Uint8Array(rightHash)),
  );
}

export function isSecureRequest(request: Request) {
  return (
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https"
  );
}

export function sessionCookie(
  name: string,
  value: string,
  maxAge: number,
  secure: boolean,
) {
  return [
    `${name}=${value}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAge}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}
