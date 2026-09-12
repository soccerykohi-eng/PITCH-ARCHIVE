import { imageUrl } from "@/app/server-data";
import { requireAdmin } from "@/app/server-auth";
import { auditStatement } from "@/app/audit";
import { getImageStore } from "@/app/server-data";
import type { SharedCard } from "@/app/types";
import { getRawDb } from "@/db";

type CardRow=Omit<SharedCard,"imageUrl"> & { imageKey:string;packCount:number;ownerCount:number };

export async function GET() {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const rows=await getRawDb().prepare(`SELECT id,name,position,country,team,number,rating,rarity,series,card_type AS cardType,season,image_key AS imageKey,
    (SELECT COUNT(*) FROM pack_cards pc WHERE pc.card_id=cards.id) AS packCount,
    (SELECT COUNT(*) FROM collection col WHERE col.card_id=cards.id) AS ownerCount
    FROM cards ORDER BY created_at DESC`).all<CardRow>();
  return Response.json({ cards:rows.results.map((card) => ({ ...card,imageUrl:imageUrl(card) })) });
}

export async function PATCH(request:Request) {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const body=await request.json().catch(() => null) as Record<string,unknown> | null;
  const id=String(body?.id ?? "").trim();
  const name=String(body?.name ?? "").trim();
  const position=String(body?.position ?? "").trim().toUpperCase();
  const country=String(body?.country ?? "").trim();
  const team=String(body?.team ?? "").trim();
  const series=String(body?.series ?? "").trim();
  const cardType=String(body?.cardType ?? "").trim().toUpperCase();
  const season=String(body?.season ?? "").trim();
  const rarity=String(body?.rarity ?? "").trim().toUpperCase();
  const number=body?.number === null || body?.number === undefined || body?.number === "" ? null : Number(body.number);
  const rating=Number(body?.rating);
  if (!id || !name || !position || !country || !series || !cardType || !season || !["CORE","RARE","ELITE","ICON"].includes(rarity) || !Number.isInteger(rating) || rating < 1 || rating > 100 || (number !== null && (!Number.isInteger(number) || number < 0 || number > 99))) return Response.json({ error:"カード情報を確認してください" },{ status:400 });
  const db=getRawDb();
  const existing=await db.prepare("SELECT id FROM cards WHERE id=?").bind(id).first();
  if (!existing) return Response.json({ error:"カードが見つかりません" },{ status:404 });
  await db.batch([
    db.prepare("UPDATE cards SET name=?,position=?,country=?,team=?,number=?,rating=?,rarity=?,series=?,card_type=?,season=? WHERE id=?").bind(name,position,country,team,number,rating,rarity,series,cardType,season,id),
    auditStatement(db,member.email,"card.update","card",id,name),
  ]);
  return Response.json({ ok:true });
}

export async function DELETE(request:Request) {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const id=String(new URL(request.url).searchParams.get("id") ?? "").trim();
  if (!id) return Response.json({ error:"カードを確認してください" },{ status:400 });
  const db=getRawDb();
  const card=await db.prepare(`SELECT image_key AS imageKey,
    (SELECT COUNT(*) FROM pack_cards WHERE card_id=cards.id) AS packCount,
    (SELECT COUNT(*) FROM collection WHERE card_id=cards.id) AS ownerCount
    FROM cards WHERE id=?`).bind(id).first<{ imageKey:string;packCount:number;ownerCount:number }>();
  if (!card) return Response.json({ error:"カードが見つかりません" },{ status:404 });
  if (card.packCount > 0 || card.ownerCount > 0) return Response.json({ error:"パックまたはコレクションで使用中のカードは削除できません" },{ status:409 });
  await db.batch([
    db.prepare("DELETE FROM cards WHERE id=?").bind(id),
    auditStatement(db,member.email,"card.delete","card",id,"登録カードを削除"),
  ]);
  if (card.imageKey && !card.imageKey.startsWith("/")) await getImageStore().delete(card.imageKey).catch(() => undefined);
  return Response.json({ ok:true });
}
