import { requireApprovedMember } from "@/app/server-auth";
import { getRawDb } from "@/db";

export const dynamic = "force-dynamic";

type NotificationRow = {
  id:string;type:"friend"|"trade"|"pack"|"account"|"announcement";title:string;message:string;
  destination:string;readAt:number|null;createdAt:number;
};

export async function GET() {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const db=getRawDb();const now=Date.now();
  await db.batch([
    db.prepare(`INSERT INTO notifications (id,user_email,type,title,message,destination,reference_type,reference_id,created_at)
      SELECT lower(hex(randomblob(16))),?, 'announcement',a.title,a.message,'packs','announcement',a.id,?
      FROM announcements a WHERE a.audience='all' AND a.publish_at<=?
      AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_email=? AND n.reference_type='announcement' AND n.reference_id=a.id)`).bind(member.email,now,now,member.email),
    db.prepare(`INSERT INTO notifications (id,user_email,type,title,message,destination,reference_type,reference_id,created_at)
      SELECT lower(hex(randomblob(16))),?, 'announcement',a.title,a.message,'packs','announcement',a.id,?
      FROM announcements a JOIN announcement_recipients ar ON ar.announcement_id=a.id
      WHERE a.audience='selected' AND ar.user_email=? AND a.publish_at<=?
      AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_email=? AND n.reference_type='announcement' AND n.reference_id=a.id)`).bind(member.email,now,member.email,now,member.email),
  ]);
  const result=await db.prepare(`SELECT id,type,title,message,destination,read_at AS readAt,created_at AS createdAt
    FROM notifications WHERE user_email=? ORDER BY created_at DESC LIMIT 50`).bind(member.email).all<NotificationRow>();
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
