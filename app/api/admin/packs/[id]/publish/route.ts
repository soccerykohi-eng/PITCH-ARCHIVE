import { requireAdmin } from "@/app/server-auth";
import { auditStatement } from "@/app/audit";
import { getRawDb } from "@/db";
import { syncPackSchedule } from "@/app/pack-schedule";

type PackStatus="draft"|"scheduled"|"published"|"archived";

export async function POST(request:Request,{ params }:{ params:Promise<{ id:string }> }) {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const { id }=await params;
  const body=await request.json().catch(() => null) as { status?:unknown;publishAt?:unknown;endAt?:unknown;openLimit?:unknown;notificationMessage?:unknown } | null;
  const status=String(body?.status ?? "") as PackStatus;
  if (!["draft","scheduled","published","archived"].includes(status)) return Response.json({ error:"公開状態が正しくありません" },{ status:400 });
  const db=getRawDb();
  await syncPackSchedule();
  const pack=await db.prepare("SELECT name,status FROM packs WHERE id=?").bind(id).first<{ name:string;status:PackStatus }>();
  if (!pack) return Response.json({ error:"パックが見つかりません" },{ status:404 });
  if (status==="draft") {
    if (pack.status!=="scheduled") return Response.json({ error:"予約中のパックだけ下書きに戻せます" },{ status:409 });
    await db.batch([db.prepare("UPDATE packs SET status='draft',publish_at=NULL,end_at=NULL WHERE id=?").bind(id),auditStatement(db,member.email,"pack.schedule.cancel","pack",id,pack.name)]);
    return Response.json({ ok:true });
  }
  if (status==="archived") {
    if (!["published","scheduled"].includes(pack.status)) return Response.json({ error:"公開中または予約中のパックだけ終了できます" },{ status:409 });
    await db.batch([db.prepare("UPDATE packs SET status='archived',end_at=COALESCE(end_at,?) WHERE id=?").bind(Date.now(),id),auditStatement(db,member.email,"pack.archive","pack",id,pack.name)]);
    return Response.json({ ok:true });
  }
  if (!["draft","scheduled"].includes(pack.status)) return Response.json({ error:"下書きまたは予約中のパックを指定してください" },{ status:409 });
  const cardCount=(await db.prepare("SELECT COUNT(*) AS total FROM pack_cards WHERE pack_id=?").bind(id).first<{ total:number }>())?.total ?? 0;
  if (cardCount<1 || cardCount>12) return Response.json({ error:"収録カードは1枚以上12枚以下にしてください" },{ status:400 });
  const openLimit=Math.max(1,Math.min(3,Number(body?.openLimit) || 1));
  const notificationMessage=String(body?.notificationMessage ?? "").trim().slice(0,120);
  const now=Date.now();
  const publishAt=status==="published" ? now : Number(body?.publishAt);
  const endAt=Number(body?.endAt);
  if (status==="scheduled" && (!Number.isFinite(publishAt) || publishAt<=now)) return Response.json({ error:"公開日時は現在より後に設定してください" },{ status:400 });
  if (!Number.isFinite(endAt) || endAt<=publishAt) return Response.json({ error:"終了日時は公開日時より後に設定してください" },{ status:400 });
  const active=(await db.prepare("SELECT COUNT(*) AS total FROM packs WHERE status='published' AND id<>?").bind(id).first<{ total:number }>())?.total ?? 0;
  if (status==="published" && active>=3) return Response.json({ error:"同時に公開できるパックは3つまでです" },{ status:409 });
  if (status==="scheduled") {
    await db.batch([db.prepare("UPDATE packs SET status='scheduled',publish_at=?,end_at=?,open_limit=?,notification_message=? WHERE id=?").bind(publishAt,endAt,openLimit,notificationMessage,id),auditStatement(db,member.email,"pack.schedule","pack",id,`${new Date(publishAt).toISOString()} / ${pack.name}`)]);
    return Response.json({ ok:true });
  }
  const players=await db.prepare("SELECT email FROM users WHERE status='approved' AND role='player'").all<{ email:string }>();
  const message=notificationMessage || pack.name;
  await db.batch([
    db.prepare("UPDATE packs SET status='published',publish_at=?,end_at=?,open_limit=?,notification_message=? WHERE id=?").bind(publishAt,endAt,openLimit,notificationMessage,id),
    ...players.results.map((player) => db.prepare("INSERT INTO notifications (id,user_email,type,title,message,destination,reference_type,reference_id,created_at) VALUES (?,?,'pack',?,?,'packs','pack',?,?)").bind(crypto.randomUUID(),player.email,"新しいパックが公開されました",message,id,now)),
    auditStatement(db,member.email,"pack.publish","pack",id,pack.name),
  ]);
  return Response.json({ ok:true });
}
