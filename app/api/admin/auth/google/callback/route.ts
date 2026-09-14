import { cookies } from "next/headers";
import { auditStatement } from "@/app/audit";
import { fetchGoogleIdentity } from "@/app/google-auth";
import { getSessionIdentity, getSessionSecret } from "@/app/server-auth";
import { ADMIN_GOOGLE_VERIFIED_COOKIE, GOOGLE_FLOW_MAX_AGE, GOOGLE_OAUTH_COOKIE, createSignedFlowToken, isSecureRequest, sessionCookie, verifySignedFlowToken } from "@/app/session";
import { getRawDb } from "@/db";

const ADMIN_EMAIL="admin@pitcharchive.local";
function redirect(request:Request,path:string,cookiesToSet:string[] = []) { const headers=new Headers({ location:new URL(path,request.url).toString(),"cache-control":"no-store" });for (const cookie of cookiesToSet) headers.append("set-cookie",cookie);return new Response(null,{ status:303,headers }); }

export async function GET(request:Request) {
  const url=new URL(request.url);const secure=isSecureRequest(request);const clear=sessionCookie(GOOGLE_OAUTH_COOKIE,"",0,secure);
  if (url.searchParams.get("error")) return redirect(request,"/admin-login?error=google-cancelled",[clear]);
  const flow=await verifySignedFlowToken((await cookies()).get(GOOGLE_OAUTH_COOKIE)?.value,getSessionSecret());
  const state=url.searchParams.get("state") ?? "";const code=url.searchParams.get("code") ?? "";
  if (!flow || flow.purpose !== "google-oauth" || flow.state !== state || !flow.codeVerifier || !code || !["admin-login","admin-link"].includes(flow.mode ?? "")) return redirect(request,"/admin-login?error=google-invalid",[clear]);
  const google=await fetchGoogleIdentity(request,code,flow.codeVerifier,true);
  if (!google) return redirect(request,"/admin-login?error=google-failed",[clear]);
  const db=getRawDb();const now=Date.now();
  if (flow.mode === "admin-link") {
    const identity=await getSessionIdentity();
    if (identity?.kind !== "admin" || identity.email !== flow.userEmail || await db.prepare("SELECT 1 FROM admin_google_identities LIMIT 1").first()) return redirect(request,"/?adminGoogle=invalid",[clear]);
    await db.batch([
      db.prepare("INSERT INTO admin_google_identities (google_sub,admin_email,google_email,google_name,created_at,last_verified_at) VALUES (?,?,?,?,?,?)").bind(google.sub,identity.email,google.email,google.name,now,now),
      auditStatement(db,identity.email,"admin.google_link","admin",identity.email,"管理者Googleアカウントを連携"),
    ]);
    return redirect(request,"/?adminGoogle=linked",[clear]);
  }
  const linked=await db.prepare("SELECT admin_email AS adminEmail FROM admin_google_identities WHERE google_sub=?").bind(google.sub).first<{ adminEmail:string }>();
  if (linked?.adminEmail !== ADMIN_EMAIL) return redirect(request,"/admin-login?error=google-not-authorized",[clear]);
  await db.batch([
    db.prepare("UPDATE admin_google_identities SET google_email=?,google_name=?,last_verified_at=? WHERE google_sub=?").bind(google.email,google.name,now,google.sub),
    auditStatement(db,ADMIN_EMAIL,"admin.google_verify","admin",ADMIN_EMAIL,"Google本人確認完了"),
  ]);
  const verified=await createSignedFlowToken({ purpose:"admin-google-verified",googleSub:google.sub,userEmail:ADMIN_EMAIL,googleEmail:google.email },getSessionSecret());
  return redirect(request,"/admin-login?verified=1",[clear,sessionCookie(ADMIN_GOOGLE_VERIFIED_COOKIE,verified,GOOGLE_FLOW_MAX_AGE,secure)]);
}
