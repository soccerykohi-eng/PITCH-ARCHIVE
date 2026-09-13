import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { bytesToBase64Url, getPasskeyRelyingParty } from "@/app/passkey";
import { getSessionIdentity, getSessionSecret, requireApprovedMember } from "@/app/server-auth";
import { isSecureRequest, sessionCookie, verifyWebAuthnChallengeToken, WEBAUTHN_CHALLENGE_COOKIE } from "@/app/session";
import { getRawDb } from "@/db";

function clearedChallengeCookie(request: Request) {
  return sessionCookie(WEBAUTHN_CHALLENGE_COOKIE,"",0,isSecureRequest(request));
}

export async function POST(request: Request) {
  const headers={ "cache-control":"no-store","set-cookie":clearedChallengeCookie(request) };
  const identity=await getSessionIdentity();
  if (identity?.kind !== "guest") return Response.json({ error:"プレイヤーセッションが必要です" },{ status:401,headers });
  const { member,response }=await requireApprovedMember();
  if (!member || response) return Response.json({ error:"このセッションは利用できません" },{ status:403,headers });
  const cookieStore=await cookies();
  const challenge=await verifyWebAuthnChallengeToken(cookieStore.get(WEBAUTHN_CHALLENGE_COOKIE)?.value,getSessionSecret());
  if (!challenge || challenge.operation !== "register" || challenge.userEmail !== member.email)
    return Response.json({ error:"パスキー登録の有効時間が切れました" },{ status:400,headers });
  try {
    const body=await request.json() as RegistrationResponseJSON;
    const rp=getPasskeyRelyingParty(request);
    const verification=await verifyRegistrationResponse({
      response:body,expectedChallenge:challenge.challenge,expectedOrigin:rp.origin,expectedRPID:rp.rpID,
      requireUserVerification:true,supportedAlgorithmIDs:[-7,-257],
    });
    if (!verification.verified) return Response.json({ error:"パスキーを確認できませんでした" },{ status:400,headers });
    const { credential,credentialDeviceType,credentialBackedUp }=verification.registrationInfo;
    await getRawDb().prepare(`INSERT INTO passkey_credentials
      (credential_id,user_email,public_key,counter,transports,device_type,backed_up,created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(credential.id,member.email,bytesToBase64Url(credential.publicKey),credential.counter,JSON.stringify(credential.transports ?? []),credentialDeviceType,credentialBackedUp ? 1 : 0,Date.now()).run();
    return Response.json({ verified:true },{ headers });
  } catch (error) {
    const message=error instanceof Error && /unique|constraint/i.test(error.message) ? "このパスキーは登録済みです" : "パスキーを登録できませんでした";
    return Response.json({ error:message },{ status:400,headers });
  }
}
