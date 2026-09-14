import { getGoogleClient, getSessionSecret } from "./server-auth";
import { createSignedFlowToken, GOOGLE_FLOW_MAX_AGE, GOOGLE_OAUTH_COOKIE, isSecureRequest, sessionCookie, type SignedFlow } from "./session";

export const GOOGLE_AUTHORIZATION_ENDPOINT="https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT="https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_ENDPOINT="https://openidconnect.googleapis.com/v1/userinfo";
export const PLAYER_GOOGLE_CALLBACK="https://pitch-archive.soccerykohi.workers.dev/api/auth/google/callback";
export const ADMIN_GOOGLE_CALLBACK="https://pitch-archive.soccerykohi.workers.dev/api/admin/auth/google/callback";

export function guestIdFromEmail(email:string) { return /^guest\+([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})@pitcharchive\.local$/i.exec(email)?.[1] ?? null; }

function base64Url(bytes:Uint8Array) { let value="";for (const byte of bytes) value+=String.fromCharCode(byte);return btoa(value).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); }
function randomValue(bytes=32) { const value=new Uint8Array(bytes);crypto.getRandomValues(value);return base64Url(value); }
export function callbackUrl(request:Request,admin=false) { const url=new URL(request.url);return url.hostname === "localhost" || url.hostname === "127.0.0.1" ? `${url.origin}${admin ? "/api/admin/auth/google/callback" : "/api/auth/google/callback"}` : admin ? ADMIN_GOOGLE_CALLBACK : PLAYER_GOOGLE_CALLBACK; }

export async function beginGoogleOAuth(request:Request,flow:Omit<SignedFlow,"purpose"|"state"|"codeVerifier"|"expiresAt">,admin=false) {
  const { clientId }=getGoogleClient();const secret=getSessionSecret();
  if (!clientId || !secret) return null;
  const state=randomValue();const codeVerifier=randomValue(48);
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(codeVerifier)));
  const token=await createSignedFlowToken({ purpose:"google-oauth",state,codeVerifier,...flow },secret);
  const target=new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  target.search=new URLSearchParams({ client_id:clientId,redirect_uri:callbackUrl(request,admin),response_type:"code",scope:"openid email profile",state,code_challenge:base64Url(digest),code_challenge_method:"S256",prompt:"select_account" }).toString();
  return { url:target.toString(),cookie:sessionCookie(GOOGLE_OAUTH_COOKIE,token,GOOGLE_FLOW_MAX_AGE,isSecureRequest(request)) };
}

export async function fetchGoogleIdentity(request:Request,code:string,codeVerifier:string,admin=false) {
  const client=getGoogleClient();
  const tokenResponse=await fetch(GOOGLE_TOKEN_ENDPOINT,{ method:"POST",headers:{ "content-type":"application/x-www-form-urlencoded" },body:new URLSearchParams({ code,client_id:client.clientId,client_secret:client.clientSecret,redirect_uri:callbackUrl(request,admin),grant_type:"authorization_code",code_verifier:codeVerifier }) });
  if (!tokenResponse.ok) return null;
  const token=await tokenResponse.json() as { access_token?:string };
  if (!token.access_token) return null;
  const userResponse=await fetch(GOOGLE_USERINFO_ENDPOINT,{ headers:{ authorization:`Bearer ${token.access_token}` } });
  if (!userResponse.ok) return null;
  const user=await userResponse.json() as { sub?:string;email?:string;name?:string };
  return user.sub ? { sub:user.sub,email:user.email ?? "",name:user.name ?? "" } : null;
}
