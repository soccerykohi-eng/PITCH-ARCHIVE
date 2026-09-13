import { getRawDb } from "@/db";

export const PASSKEY_RP_NAME = "PITCH ARCHIVE";
export const PASSKEY_ORIGIN = "https://pitch-archive.soccerykohi.workers.dev";
export const PASSKEY_RP_ID = "pitch-archive.soccerykohi.workers.dev";

export function getPasskeyRelyingParty(request: Request) {
  const url = new URL(request.url);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return { origin:url.origin,rpID:url.hostname,rpName:PASSKEY_RP_NAME };
  }
  return { origin:PASSKEY_ORIGIN,rpID:PASSKEY_RP_ID,rpName:PASSKEY_RP_NAME };
}

export function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(value: string) {
  const normalized=value.replace(/-/g,"+").replace(/_/g,"/");
  const binary=atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4,"="));
  return Uint8Array.from(binary,(character) => character.charCodeAt(0));
}

export function guestIdFromEmail(email: string) {
  const match=/^guest\+([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})@pitcharchive\.local$/i.exec(email);
  return match?.[1] ?? null;
}

export async function passkeyCount(userEmail: string) {
  const row=await getRawDb().prepare("SELECT COUNT(*) AS count FROM passkey_credentials WHERE user_email = ?").bind(userEmail).first<{ count:number }>();
  return Number(row?.count ?? 0);
}
