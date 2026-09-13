import { auditStatement } from "@/app/audit";
import { requireAdmin } from "@/app/server-auth";
import { getImageStore } from "@/app/server-data";
import { getRawDb } from "@/db";

type PurgeCard={ id:string;name:string;imageKey:string };
type PurgeImpact={ owners:number;copies:number;packs:number;showcases:number;openingsPreserved:number;claimsPreserved:number;trades:number;exchangeOffers:number;activePacks:number };

async function findCard(id:string) {
  return getRawDb().prepare("SELECT id,name,image_key AS imageKey FROM cards WHERE id=?").bind(id).first<PurgeCard>();
}

async function impact(id:string):Promise<PurgeImpact> {
  const row=await getRawDb().prepare(`SELECT
    (SELECT COUNT(DISTINCT user_email) FROM collection WHERE card_id=?) AS owners,
    (SELECT COALESCE(SUM(quantity),0) FROM collection WHERE card_id=?) AS copies,
    (SELECT COUNT(*) FROM pack_cards WHERE card_id=?) AS packs,
    (SELECT COUNT(*) FROM card_showcase WHERE card_id=?) AS showcases,
    (SELECT COUNT(*) FROM pack_openings WHERE card_id=?) AS openingsPreserved,
    (SELECT COUNT(*) FROM pack_claims WHERE card_id=?) AS claimsPreserved,
    (SELECT COUNT(*) FROM trades WHERE offered_card_id=? OR requested_card_id=?) AS trades,
    (SELECT COUNT(*) FROM daily_exchange_offers WHERE card_id=?) AS exchangeOffers,
    (SELECT COUNT(*) FROM pack_cards pc JOIN packs p ON p.id=pc.pack_id WHERE pc.card_id=? AND p.status IN ('scheduled','published')) AS activePacks`)
    .bind(id,id,id,id,id,id,id,id,id,id).first<PurgeImpact>();
  return { owners:Number(row?.owners ?? 0),copies:Number(row?.copies ?? 0),packs:Number(row?.packs ?? 0),showcases:Number(row?.showcases ?? 0),openingsPreserved:Number(row?.openingsPreserved ?? 0),claimsPreserved:Number(row?.claimsPreserved ?? 0),trades:Number(row?.trades ?? 0),exchangeOffers:Number(row?.exchangeOffers ?? 0),activePacks:Number(row?.activePacks ?? 0) };
}

export async function GET(request:Request) {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const id=String(new URL(request.url).searchParams.get("id") ?? "").trim();
  if (!id) return Response.json({ error:"カードを確認してください" },{ status:400 });
  const card=await findCard(id);
  if (!card) return Response.json({ error:"カードが見つかりません" },{ status:404 });
  return Response.json({ card:{ id:card.id,name:card.name },impact:await impact(id) },{ headers:{ "cache-control":"no-store" } });
}

export async function POST(request:Request) {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const body=await request.json().catch(() => null) as { id?:unknown;confirmName?:unknown } | null;
  const id=String(body?.id ?? "").trim();
  const confirmName=String(body?.confirmName ?? "");
  if (!id) return Response.json({ error:"カードを確認してください" },{ status:400 });
  const card=await findCard(id);
  if (!card) return Response.json({ error:"カードが見つかりません" },{ status:404 });
  if (confirmName !== card.name) return Response.json({ error:"確認用のカード名が一致しません" },{ status:400 });
  const currentImpact=await impact(id);
  if (currentImpact.activePacks > 0) return Response.json({ error:"公開中または公開予定のパックで使用されています。先にパックを終了・アーカイブしてください。" },{ status:409 });
  const db=getRawDb();
  const detail=JSON.stringify({ cardName:card.name,owners:currentImpact.owners,copies:currentImpact.copies,packs:currentImpact.packs,showcases:currentImpact.showcases,trades:currentImpact.trades,openingsPreserved:currentImpact.openingsPreserved,claimsPreserved:currentImpact.claimsPreserved });
  await db.batch([
    db.prepare("DELETE FROM collection WHERE card_id=?").bind(id),
    db.prepare("DELETE FROM card_showcase WHERE card_id=?").bind(id),
    db.prepare("DELETE FROM pack_cards WHERE card_id=?").bind(id),
    db.prepare("DELETE FROM trades WHERE offered_card_id=? OR requested_card_id=?").bind(id,id),
    db.prepare("DELETE FROM daily_exchange_offers WHERE card_id=?").bind(id),
    db.prepare("DELETE FROM notifications WHERE reference_type='card' AND reference_id=?").bind(id),
    db.prepare("UPDATE pack_openings SET card_id=NULL WHERE card_id=?").bind(id),
    db.prepare("UPDATE pack_claims SET card_id=NULL WHERE card_id=?").bind(id),
    db.prepare("DELETE FROM cards WHERE id=?").bind(id),
    auditStatement(db,member.email,"card.purge","card",id,detail),
  ]);
  let imageDeleted=true;
  if (card.imageKey && !card.imageKey.startsWith("/")) {
    try { await getImageStore().delete(card.imageKey); }
    catch { imageDeleted=false; }
  }
  return Response.json({ ok:true,imageDeleted,impact:currentImpact });
}
