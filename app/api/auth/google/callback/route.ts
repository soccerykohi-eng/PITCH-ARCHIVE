import { cookies } from "next/headers";
import { auditStatement } from "@/app/audit";
import { fetchGoogleIdentity, guestIdFromEmail } from "@/app/google-auth";
import { getSessionIdentity, getSessionSecret } from "@/app/server-auth";
import { createGuestSessionToken, createSignedFlowToken, GOOGLE_FLOW_MAX_AGE, GOOGLE_OAUTH_COOKIE, GOOGLE_PENDING_COOKIE, GUEST_SESSION_COOKIE, GUEST_SESSION_MAX_AGE, isSecureRequest, sessionCookie, verifySignedFlowToken } from "@/app/session";
import { getRawDb } from "@/db";

function redirect(request:Request,path:string,cookiesToSet:string[] = []) { const headers=new Headers({ location:new URL(path,request.url).toString(),"cache-control":"no-store" });for (const cookie of cookiesToSet) headers.append("set-cookie",cookie);return new Response(null,{ status:303,headers }); }

export async function GET(request:Request) {
  const url=new URL(request.url);const secure=isSecureRequest(request);
  const clear=sessionCookie(GOOGLE_OAUTH_COOKIE,"",0,secure);
  if (url.searchParams.get("error")) return redirect(request,"/?google=cancelled",[clear]);
  const flow=await verifySignedFlowToken((await cookies()).get(GOOGLE_OAUTH_COOKIE)?.value,getSessionSecret());
  const state=url.searchParams.get("state") ?? "";const code=url.searchParams.get("code") ?? "";
  if (!flow || flow.purpose !== "google-oauth" || !flow.state || flow.state !== state || !flow.codeVerifier || !flow.mode || !code) return redirect(request,"/?google=invalid",[clear]);
  const google=await fetchGoogleIdentity(request,code,flow.codeVerifier);
  if (!google) return redirect(request,"/?google=failed",[clear]);
  const db=getRawDb();const now=Date.now();
  if (flow.mode === "link") {
    const identity=await getSessionIdentity();
    if (identity?.kind !== "guest" || identity.email !== flow.userEmail) return redirect(request,"/?google=invalid",[clear]);
    const bySub=await db.prepare("SELECT user_email AS userEmail FROM google_identities WHERE google_sub=?").bind(google.sub).first<{ userEmail:string }>();
    const byUser=await db.prepare("SELECT google_sub AS googleSub FROM google_identities WHERE user_email=?").bind(identity.email).first<{ googleSub:string }>();
    if ((bySub && bySub.userEmail !== identity.email) || (byUser && byUser.googleSub !== google.sub)) return redirect(request,"/?google=link-conflict",[clear]);
    if (!bySub && !byUser) await db.batch([
      db.prepare("INSERT INTO google_identities (google_sub,user_email,google_email,google_name,created_at,last_login_at) VALUES (?,?,?,?,?,?)").bind(google.sub,identity.email,google.email,google.name,now,now),
      auditStatement(db,identity.email,"user.google_link","user",identity.email,"Googleアカウントを連携"),
    ]);
    return redirect(request,"/?google=linked",[clear]);
  }
  const linked=await db.prepare("SELECT user_email AS userEmail FROM google_identities WHERE google_sub=?").bind(google.sub).first<{ userEmail:string }>();
  if (linked) {
    const guestId=guestIdFromEmail(linked.userEmail);
    if (!guestId) return redirect(request,"/?google=failed",[clear]);
    await db.prepare("UPDATE google_identities SET google_email=?,google_name=?,last_login_at=? WHERE google_sub=?").bind(google.email,google.name,now,google.sub).run();
    const session=await createGuestSessionToken(guestId,getSessionSecret());
    return redirect(request,"/",[clear,sessionCookie(GUEST_SESSION_COOKIE,session,GUEST_SESSION_MAX_AGE,secure)]);
  }
  const pending=await createSignedFlowToken({ purpose:"google-pending",googleSub:google.sub,googleEmail:google.email,googleName:google.name },getSessionSecret());
  return redirect(request,"/?google=new",[clear,sessionCookie(GOOGLE_PENDING_COOKIE,pending,GOOGLE_FLOW_MAX_AGE,secure)]);
}
