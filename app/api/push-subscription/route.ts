import { requireApprovedMember } from "@/app/server-auth";
import { getRawDb } from "@/db";
import { getPushPublicKey } from "@/app/push";

type SubscriptionBody = { endpoint?:string;keys?:{ p256dh?:string;auth?:string } };

export const dynamic="force-dynamic";

export async function GET() {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const publicKey=getPushPublicKey();
  if (!publicKey) return Response.json({ error:"通知の準備が完了していません" },{ status:503 });
  return Response.json({ publicKey });
}

export async function POST(request:Request) {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const body=await request.json().catch(() => null) as SubscriptionBody | null;
  const endpoint=String(body?.endpoint ?? "");const p256dh=String(body?.keys?.p256dh ?? "");const auth=String(body?.keys?.auth ?? "");
  if (!endpoint || !p256dh || !auth || endpoint.length > 2000) return Response.json({ error:"通知設定を確認してください" },{ status:400 });
  const now=Date.now();
  await getRawDb().prepare(`INSERT INTO push_subscriptions (endpoint,user_email,p256dh,auth,created_at,updated_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(endpoint) DO UPDATE SET user_email=excluded.user_email,p256dh=excluded.p256dh,auth=excluded.auth,updated_at=excluded.updated_at`).bind(endpoint,member.email,p256dh,auth,now,now).run();
  return Response.json({ ok:true });
}

export async function DELETE(request:Request) {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const body=await request.json().catch(() => null) as SubscriptionBody | null;
  const endpoint=String(body?.endpoint ?? "");
  if (endpoint) await getRawDb().prepare("DELETE FROM push_subscriptions WHERE endpoint=? AND user_email=?").bind(endpoint,member.email).run();
  return Response.json({ ok:true });
}
