import { auditStatement } from "@/app/audit";
import { requireAdmin } from "@/app/server-auth";
import { getRawDb } from "@/db";

export const dynamic = "force-dynamic";

type AnnouncementBody = { id?:string;title?:string;message?:string;audience?:string;publishAt?:number;recipientEmails?:string[] };

export async function GET() {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const db=getRawDb();
  const result=await db.prepare(`SELECT a.id,a.title,a.message,a.audience,a.publish_at AS publishAt,a.created_at AS createdAt,a.updated_at AS updatedAt,
    GROUP_CONCAT(ar.user_email) AS recipients FROM announcements a LEFT JOIN announcement_recipients ar ON ar.announcement_id=a.id
    GROUP BY a.id ORDER BY a.publish_at DESC LIMIT 50`).all<{ id:string;title:string;message:string;audience:"all"|"selected";publishAt:number;createdAt:number;updatedAt:number;recipients:string|null }>();
  return Response.json({ announcements:result.results.map((item) => ({ ...item,recipientEmails:item.recipients ? item.recipients.split(",") : [] })) });
}

function normalize(body:AnnouncementBody) {
  const title=String(body.title ?? "").trim();
  const message=String(body.message ?? "").trim();
  const audience=body.audience === "selected" ? "selected" as const : "all" as const;
  const publishAt=Number(body.publishAt ?? Date.now());
  const recipientEmails=Array.from(new Set((body.recipientEmails ?? []).map((email) => String(email).trim().toLowerCase()).filter(Boolean)));
  return { title,message,audience,publishAt,recipientEmails };
}

export async function POST(request:Request) {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const body=await request.json().catch(() => ({})) as AnnouncementBody;
  const data=normalize(body);
  if (!data.title || !data.message || !Number.isFinite(data.publishAt)) return Response.json({ error:"タイトル・本文・公開日時を確認してください" },{ status:400 });
  if (data.title.length > 60 || data.message.length > 500) return Response.json({ error:"タイトルは60文字、本文は500文字以内にしてください" },{ status:400 });
  if (data.audience === "selected" && !data.recipientEmails.length) return Response.json({ error:"送信先を選択してください" },{ status:400 });
  const db=getRawDb();const id=crypto.randomUUID();const now=Date.now();
  await db.batch([
    db.prepare("INSERT INTO announcements (id,title,message,audience,publish_at,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,data.title,data.message,data.audience,data.publishAt,member.email,now,now),
    ...data.recipientEmails.map((email) => db.prepare("INSERT INTO announcement_recipients (announcement_id,user_email) SELECT ?,email FROM users WHERE email=? AND status='approved'").bind(id,email)),
    auditStatement(db,member.email,"announcement.create","announcement",id,data.title),
  ]);
  return Response.json({ ok:true,id });
}

export async function PATCH(request:Request) {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const body=await request.json().catch(() => ({})) as AnnouncementBody;
  const id=String(body.id ?? "");const data=normalize(body);
  if (!id || !data.title || !data.message || !Number.isFinite(data.publishAt)) return Response.json({ error:"お知らせ内容を確認してください" },{ status:400 });
  if (data.title.length > 60 || data.message.length > 500) return Response.json({ error:"タイトルは60文字、本文は500文字以内にしてください" },{ status:400 });
  if (data.audience === "selected" && !data.recipientEmails.length) return Response.json({ error:"送信先を選択してください" },{ status:400 });
  const db=getRawDb();const now=Date.now();
  await db.batch([
    db.prepare("UPDATE announcements SET title=?,message=?,audience=?,publish_at=?,updated_at=? WHERE id=?").bind(data.title,data.message,data.audience,data.publishAt,now,id),
    db.prepare("DELETE FROM announcement_recipients WHERE announcement_id=?").bind(id),
    ...data.recipientEmails.map((email) => db.prepare("INSERT INTO announcement_recipients (announcement_id,user_email) SELECT ?,email FROM users WHERE email=? AND status='approved'").bind(id,email)),
    db.prepare("UPDATE notifications SET title=?,message=? WHERE reference_type='announcement' AND reference_id=?").bind(data.title,data.message,id),
    auditStatement(db,member.email,"announcement.update","announcement",id,data.title),
  ]);
  return Response.json({ ok:true });
}

export async function DELETE(request:Request) {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const body=await request.json().catch(() => ({})) as { id?:string };
  const id=String(body.id ?? "");if (!id) return Response.json({ error:"お知らせを確認してください" },{ status:400 });
  const db=getRawDb();
  await db.batch([
    db.prepare("DELETE FROM notifications WHERE reference_type='announcement' AND reference_id=?").bind(id),
    db.prepare("DELETE FROM announcements WHERE id=?").bind(id),
    auditStatement(db,member.email,"announcement.delete","announcement",id),
  ]);
  return Response.json({ ok:true });
}
