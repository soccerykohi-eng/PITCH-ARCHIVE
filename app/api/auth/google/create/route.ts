import { cookies } from "next/headers";
import { getSessionSecret } from "@/app/server-auth";
import { createGuestSessionToken, GOOGLE_PENDING_COOKIE, GUEST_SESSION_COOKIE, GUEST_SESSION_MAX_AGE, guestDisplayName, guestPrincipal, isSecureRequest, sessionCookie, verifySignedFlowToken } from "@/app/session";
import { getRawDb } from "@/db";

export async function POST(request:Request) {
  const secure=isSecureRequest(request);const headers=new Headers({ "cache-control":"no-store" });headers.append("set-cookie",sessionCookie(GOOGLE_PENDING_COOKIE,"",0,secure));
  const pending=await verifySignedFlowToken((await cookies()).get(GOOGLE_PENDING_COOKIE)?.value,getSessionSecret());
  if (!pending || pending.purpose !== "google-pending" || !pending.googleSub) return Response.json({ error:"Google認証の有効時間が切れました" },{ status:400,headers });
  const db=getRawDb();
  const existing=await db.prepare("SELECT user_email FROM google_identities WHERE google_sub=?").bind(pending.googleSub).first();
  if (existing) return Response.json({ error:"このGoogleアカウントはすでに登録されています" },{ status:409,headers });
  const guestId=crypto.randomUUID();const email=guestPrincipal(guestId);const now=Date.now();
  await db.batch([
    db.prepare("INSERT INTO users (email,display_name,role,status,created_at) VALUES (?,?,'player','approved',?)").bind(email,guestDisplayName(guestId),now),
    db.prepare("INSERT INTO google_identities (google_sub,user_email,google_email,google_name,created_at,last_login_at) VALUES (?,?,?,?,?,?)").bind(pending.googleSub,email,pending.googleEmail ?? "",pending.googleName ?? "",now,now),
  ]);
  headers.append("set-cookie",sessionCookie(GUEST_SESSION_COOKIE,await createGuestSessionToken(guestId,getSessionSecret()),GUEST_SESSION_MAX_AGE,secure));
  return Response.json({ created:true },{ status:201,headers });
}
