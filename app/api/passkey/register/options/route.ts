import { generateRegistrationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransport } from "@simplewebauthn/server";
import { getPasskeyRelyingParty, guestIdFromEmail } from "@/app/passkey";
import { getSessionIdentity, getSessionSecret, requireApprovedMember } from "@/app/server-auth";
import { createWebAuthnChallengeToken, isSecureRequest, sessionCookie, WEBAUTHN_CHALLENGE_COOKIE, WEBAUTHN_CHALLENGE_MAX_AGE } from "@/app/session";
import { getRawDb } from "@/db";

export async function POST(request: Request) {
  const identity=await getSessionIdentity();
  if (identity?.kind !== "guest") return Response.json({ error:"プレイヤーセッションが必要です" },{ status:401 });
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const guestId=guestIdFromEmail(member.email);
  if (!guestId) return Response.json({ error:"このアカウントにはパスキーを登録できません" },{ status:400 });
  const existing=await getRawDb().prepare("SELECT credential_id AS id, transports FROM passkey_credentials WHERE user_email = ?").bind(member.email).all<{ id:string;transports:string }>();
  const rp=getPasskeyRelyingParty(request);
  const options=await generateRegistrationOptions({
    rpName:rp.rpName,
    rpID:rp.rpID,
    userName:member.email,
    userDisplayName:member.displayName,
    userID:new TextEncoder().encode(guestId),
    attestationType:"none",
    excludeCredentials:existing.results.map((credential: { id:string;transports:string }) => ({
      id:credential.id,
      transports:JSON.parse(credential.transports || "[]") as AuthenticatorTransport[],
    })),
    authenticatorSelection:{ residentKey:"required",userVerification:"required" },
    supportedAlgorithmIDs:[-7,-257],
  });
  const challengeToken=await createWebAuthnChallengeToken({ challenge:options.challenge,operation:"register",userEmail:member.email },getSessionSecret());
  return Response.json(options,{ headers:{
    "cache-control":"no-store",
    "set-cookie":sessionCookie(WEBAUTHN_CHALLENGE_COOKIE,challengeToken,WEBAUTHN_CHALLENGE_MAX_AGE,isSecureRequest(request)),
  } });
}
