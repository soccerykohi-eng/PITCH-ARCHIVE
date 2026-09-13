import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, AuthenticatorTransport } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { base64UrlToBytes, getPasskeyRelyingParty, guestIdFromEmail } from "@/app/passkey";
import { getSessionSecret } from "@/app/server-auth";
import { createGuestSessionToken, GUEST_SESSION_COOKIE, GUEST_SESSION_MAX_AGE, isSecureRequest, sessionCookie, verifyWebAuthnChallengeToken, WEBAUTHN_CHALLENGE_COOKIE } from "@/app/session";
import { getRawDb } from "@/db";

type StoredCredential={ credentialId:string;userEmail:string;publicKey:string;counter:number;transports:string };

export async function POST(request: Request) {
  const secure=isSecureRequest(request);
  const headers=new Headers({ "cache-control":"no-store" });
  headers.append("set-cookie",sessionCookie(WEBAUTHN_CHALLENGE_COOKIE,"",0,secure));
  const secret=getSessionSecret();
  const challenge=await verifyWebAuthnChallengeToken((await cookies()).get(WEBAUTHN_CHALLENGE_COOKIE)?.value,secret);
  if (!challenge || challenge.operation !== "login")
    return Response.json({ error:"パスキー認証の有効時間が切れました" },{ status:400,headers });
  try {
    const body=await request.json() as AuthenticationResponseJSON;
    const credential=await getRawDb().prepare(`SELECT credential_id AS credentialId,user_email AS userEmail,
      public_key AS publicKey,counter,transports FROM passkey_credentials WHERE credential_id = ?`)
      .bind(body.id).first<StoredCredential>();
    if (!credential) return Response.json({ error:"このパスキーはPITCH ARCHIVEに登録されていません" },{ status:401,headers });
    const user=await getRawDb().prepare("SELECT email FROM users WHERE email = ? AND role = 'player'").bind(credential.userEmail).first<{ email:string }>();
    const guestId=user ? guestIdFromEmail(user.email) : null;
    if (!guestId) return Response.json({ error:"復元するアカウントが見つかりません" },{ status:401,headers });
    const rp=getPasskeyRelyingParty(request);
    const verification=await verifyAuthenticationResponse({
      response:body,expectedChallenge:challenge.challenge,expectedOrigin:rp.origin,expectedRPID:rp.rpID,
      requireUserVerification:true,
      credential:{ id:credential.credentialId,publicKey:base64UrlToBytes(credential.publicKey),counter:credential.counter,transports:JSON.parse(credential.transports || "[]") as AuthenticatorTransport[] },
    });
    if (!verification.verified) return Response.json({ error:"パスキーを確認できませんでした" },{ status:401,headers });
    await getRawDb().prepare("UPDATE passkey_credentials SET counter = ?, last_used_at = ? WHERE credential_id = ?")
      .bind(verification.authenticationInfo.newCounter,Date.now(),credential.credentialId).run();
    headers.append("set-cookie",sessionCookie(GUEST_SESSION_COOKIE,await createGuestSessionToken(guestId,secret),GUEST_SESSION_MAX_AGE,secure));
    return Response.json({ verified:true },{ headers });
  } catch {
    return Response.json({ error:"パスキーを確認できませんでした" },{ status:400,headers });
  }
}
