import { cookies } from "next/headers";
import { auditStatement } from "@/app/audit";
import { getAdminAccessKey, getSessionSecret } from "@/app/server-auth";
import { getRawDb } from "@/db";
import {
  ADMIN_GOOGLE_VERIFIED_COOKIE,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSessionToken,
  isSecureRequest,
  secretsEqual,
  sessionCookie,
  verifySignedFlowToken,
} from "@/app/session";

const ADMIN_EMAIL="admin@pitcharchive.local";

export async function POST(request:Request) {
  const accessKey=String((await request.formData()).get("accessKey") ?? "");
  const expected=getAdminAccessKey();
  const secret=getSessionSecret();
  if (!expected || !secret) return new Response("Admin configuration is unavailable",{ status:500 });
  if (!(await secretsEqual(accessKey,expected)))
    return Response.redirect(new URL("/admin-login?error=1",request.url),303);
  const db=getRawDb();
  const linked=await db.prepare("SELECT google_sub AS googleSub FROM admin_google_identities WHERE admin_email=?").bind(ADMIN_EMAIL).first<{ googleSub:string }>();
  if (linked) {
    const verified=await verifySignedFlowToken((await cookies()).get(ADMIN_GOOGLE_VERIFIED_COOKIE)?.value,secret);
    if (!verified || verified.purpose !== "admin-google-verified" || verified.userEmail !== ADMIN_EMAIL || verified.googleSub !== linked.googleSub)
      return Response.redirect(new URL("/admin-login?error=google-required",request.url),303);
  }
  const now=Date.now();
  await db.batch([
    db.prepare("INSERT INTO users (email,display_name,role,status,created_at) VALUES (?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET role='admin',status='approved'").bind(ADMIN_EMAIL,"PITCH ARCHIVE ADMIN","admin","approved",now),
    auditStatement(db,ADMIN_EMAIL,"admin.login","admin",ADMIN_EMAIL,linked ? "Google確認とアクセスキーでログイン" : "アクセスキーでログイン（初期連携前）"),
  ]);
  const token=await createAdminSessionToken(secret);
  const headers=new Headers({ location:new URL("/",request.url).toString(),"cache-control":"no-store" });
  headers.append("set-cookie",sessionCookie(ADMIN_SESSION_COOKIE,token,ADMIN_SESSION_MAX_AGE,isSecureRequest(request)));
  headers.append("set-cookie",sessionCookie(ADMIN_GOOGLE_VERIFIED_COOKIE,"",0,isSecureRequest(request)));
  return new Response(null,{
    status:303,
    headers,
  });
}
