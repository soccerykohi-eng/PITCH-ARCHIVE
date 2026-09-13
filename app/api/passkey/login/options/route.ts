import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { createWebAuthnChallengeToken, isSecureRequest, sessionCookie, WEBAUTHN_CHALLENGE_COOKIE, WEBAUTHN_CHALLENGE_MAX_AGE } from "@/app/session";
import { getPasskeyRelyingParty } from "@/app/passkey";
import { getSessionSecret } from "@/app/server-auth";

export async function POST(request: Request) {
  const secret=getSessionSecret();
  if (!secret) return Response.json({ error:"Session configuration is unavailable" },{ status:500 });
  const rp=getPasskeyRelyingParty(request);
  const options=await generateAuthenticationOptions({ rpID:rp.rpID,userVerification:"required" });
  const token=await createWebAuthnChallengeToken({ challenge:options.challenge,operation:"login" },secret);
  return Response.json(options,{ headers:{
    "cache-control":"no-store",
    "set-cookie":sessionCookie(WEBAUTHN_CHALLENGE_COOKIE,token,WEBAUTHN_CHALLENGE_MAX_AGE,isSecureRequest(request)),
  } });
}
