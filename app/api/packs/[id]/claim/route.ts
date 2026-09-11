import { requireApprovedMember } from "@/app/server-auth";
import { getRawDb } from "@/db";
import { syncPackSchedule } from "@/app/pack-schedule";

export async function POST(request:Request,{ params }:{ params:Promise<{ id:string }> }) {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const { id:packId }=await params;
  void request;
  const db=getRawDb();
  await syncPackSchedule();
  const pack=await db.prepare("SELECT status,open_limit AS openLimit FROM packs WHERE id=?").bind(packId).first<{ status:string;openLimit:number }>();
  if (!pack || pack.status!=="published") return Response.json({ error:"このパックは現在開封できません" },{ status:400 });
  const count=await db.prepare(`SELECT (SELECT COUNT(*) FROM pack_openings WHERE user_email=? AND pack_id=?)+CASE WHEN EXISTS(SELECT 1 FROM pack_claims WHERE user_email=? AND pack_id=?) THEN 1 ELSE 0 END AS total`).bind(member.email,packId,member.email,packId).first<{ total:number }>();
  if ((count?.total ?? 0)>=pack.openLimit) return Response.json({ error:"このパックの開封上限に達しています" },{ status:409 });
  const drawn=await db.prepare(`SELECT c.id FROM cards c
    JOIN pack_cards pc ON pc.card_id=c.id
    JOIN packs p ON p.id=pc.pack_id
    WHERE p.id=? AND p.status='published'
    ORDER BY RANDOM() LIMIT 1`).bind(packId).first<{ id:string }>();
  if (!drawn) return Response.json({ error:"このパックは現在開封できません" },{ status:400 });
  const now=Date.now();
  try {
    await db.batch([
      db.prepare("INSERT INTO pack_openings (id,user_email,pack_id,card_id,opened_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),member.email,packId,drawn.id,now),
      db.prepare(`INSERT INTO collection (user_email,card_id,quantity,source_pack_id,acquired_at) VALUES (?,?,1,?,?)
        ON CONFLICT(user_email,card_id) DO UPDATE SET quantity=collection.quantity+1,source_pack_id=excluded.source_pack_id,acquired_at=excluded.acquired_at`).bind(member.email,drawn.id,packId,now)
    ]);
  } catch {
    return Response.json({ error:"パックを開封できませんでした" },{ status:409 });
  }
  return Response.json({ ok:true,cardId:drawn.id });
}
