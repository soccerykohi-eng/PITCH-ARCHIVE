import { requireApprovedMember } from "@/app/server-auth";
import { getRawDb } from "@/db";

export const dynamic = "force-dynamic";

type NotificationRow = {
  id:string;type:"friend"|"trade"|"pack"|"account";title:string;message:string;
  destination:string;readAt:number|null;createdAt:number;
};

export async function GET() {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const db=getRawDb();
  const result=await db.prepare(`SELECT id,type,title,message,destination,read_at AS readAt,created_at AS createdAt
    FROM notifications WHERE user_email=? AND type<>'announcement' ORDER BY created_at DESC LIMIT 50`).bind(member.email).all<NotificationRow>();
  return Response.json({ notifications:result.results,unreadCount:result.results.filter((item) => item.readAt === null).length });
}

export async function PATCH(request:Request) {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const body=await request.json().catch(() => null) as { action?:string;id?:string } | null;
  const action=String(body?.action ?? "");
  const now=Date.now();
  if (action === "read-all") {
    await getRawDb().prepare("UPDATE notifications SET read_at=? WHERE user_email=? AND read_at IS NULL").bind(now,member.email).run();
    return Response.json({ ok:true });
  }
  if (action === "read") {
    const id=String(body?.id ?? "");
    if (!id) return Response.json({ error:"通知を確認してください" },{ status:400 });
    await getRawDb().prepare("UPDATE notifications SET read_at=? WHERE id=? AND user_email=?").bind(now,id,member.email).run();
    return Response.json({ ok:true });
  }
  return Response.json({ error:"操作を確認してください" },{ status:400 });
}
