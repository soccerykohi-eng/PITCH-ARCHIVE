import { BUILTIN_CARDS } from "@/app/builtin-catalog";
import { requireAdmin } from "@/app/server-auth";
import { getRawDb } from "@/db";

export async function POST() {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const db=getRawDb();
  const packId="first-edition";
  const statements=[db.prepare("INSERT OR IGNORE INTO packs (id,name,description,status,point_cost,created_at) VALUES (?,?,?,'draft',0,?)").bind(packId,"FIRST EDITION","PITCH ARCHIVEの初期カードを収録したパック。",Date.now())];
  BUILTIN_CARDS.forEach((card,index) => {
    statements.push(db.prepare(`INSERT OR IGNORE INTO cards (id,name,position,country,team,number,rating,rarity,series,card_type,season,image_key,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(card.id,card.name,card.position,card.country,card.team,card.number,card.rating,card.rarity,card.series,card.cardType,card.season,card.imageKey,Date.now()));
    statements.push(db.prepare("INSERT OR IGNORE INTO pack_cards (pack_id,card_id,sort_order) VALUES (?,?,?)").bind(packId,card.id,index));
  });
  await db.batch(statements);
  return Response.json({ ok:true });
}
