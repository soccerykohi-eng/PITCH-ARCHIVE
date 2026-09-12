import { getRawDb } from "@/db";

type ScheduledPack = { id:string;name:string;notificationMessage:string };

export async function syncPackSchedule() {
  const db=getRawDb();
  const now=Date.now();
  // Before archived packs existed, ending a release returned it to draft.
  // Recover only packs with durable evidence that they were opened or published,
  // so unfinished drafts remain private.
  await db.prepare(`UPDATE packs SET status='archived'
    WHERE status='draft' AND (
      EXISTS (SELECT 1 FROM pack_claims pc WHERE pc.pack_id=packs.id)
      OR EXISTS (SELECT 1 FROM pack_openings po WHERE po.pack_id=packs.id)
      OR EXISTS (SELECT 1 FROM collection c WHERE c.source_pack_id=packs.id)
      OR EXISTS (SELECT 1 FROM audit_logs a WHERE a.target_type='pack' AND a.target_id=packs.id AND a.action='pack.publish')
    )`).run();
  await db.prepare("UPDATE packs SET status='archived' WHERE status IN ('scheduled','published') AND end_at IS NOT NULL AND end_at<=?").bind(now).run();
  const due=await db.prepare("SELECT id,name,notification_message AS notificationMessage FROM packs WHERE status='scheduled' AND publish_at IS NOT NULL AND publish_at<=? ORDER BY publish_at").bind(now).all<ScheduledPack>();
  if (!due.results.length) return;
  let active=(await db.prepare("SELECT COUNT(*) AS total FROM packs WHERE status='published'").first<{ total:number }>())?.total ?? 0;
  for (const pack of due.results) {
    if (active>=3) break;
    const players=await db.prepare("SELECT email FROM users WHERE status='approved' AND role='player'").all<{ email:string }>();
    const message=pack.notificationMessage || pack.name;
    await db.batch([
      db.prepare("UPDATE packs SET status='published' WHERE id=? AND status='scheduled'").bind(pack.id),
      ...players.results.map((player) => db.prepare("INSERT INTO notifications (id,user_email,type,title,message,destination,reference_type,reference_id,created_at) VALUES (?,?,'pack',?,?,'packs','pack',?,?)").bind(crypto.randomUUID(),player.email,"新しいパックが公開されました",message,pack.id,now)),
    ]);
    active+=1;
  }
}
