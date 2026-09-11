import { env } from "cloudflare:workers";
import { getRawDb } from "@/db";
import type { PackView, SharedCard } from "./types";
import { syncPackSchedule } from "./pack-schedule";

type CardRow = Omit<SharedCard,"imageUrl"> & { imageKey:string };
type PackRow = Omit<PackView,"cards">;
type RuntimeEnv = { CARD_IMAGES:KVNamespace };

export function imageUrl(card:{ id:string;imageKey:string }) {
  const version=encodeURIComponent(card.imageKey);
  return card.imageKey.startsWith("/") ? `${card.imageKey}?v=${version}` : `/api/card-image/${encodeURIComponent(card.id)}?v=${version}`;
}

export async function getPacksForUser(email:string,includeDrafts=false):Promise<PackView[]> {
  const db=getRawDb();
  await syncPackSchedule();
  const packs=await db.prepare(`SELECT p.id,p.name,p.description,p.status,p.open_limit AS openLimit,p.publish_at AS publishAt,p.end_at AS endAt,p.notification_message AS notificationMessage,
    COALESCE((SELECT po.card_id FROM pack_openings po WHERE po.pack_id=p.id AND po.user_email=? ORDER BY po.opened_at DESC LIMIT 1),(SELECT pc.card_id FROM pack_claims pc WHERE pc.pack_id=p.id AND pc.user_email=?)) AS claimedCardId,
    (SELECT COUNT(*) FROM pack_openings po WHERE po.pack_id=p.id AND po.user_email=?)+CASE WHEN EXISTS(SELECT 1 FROM pack_claims pc WHERE pc.pack_id=p.id AND pc.user_email=?) THEN 1 ELSE 0 END AS openCount
    FROM packs p ${includeDrafts ? "" : "WHERE p.status IN ('published','archived')"} ORDER BY COALESCE(p.publish_at,p.created_at) DESC`).bind(email,email,email,email).all<PackRow>();
  const output:PackView[]=[];
  for (const pack of packs.results) {
    const cards=await db.prepare(`SELECT c.id,c.name,c.position,c.country,c.team,c.number,c.rating,c.rarity,c.series,c.card_type AS cardType,c.season,c.image_key AS imageKey
      FROM cards c JOIN pack_cards pc ON pc.card_id=c.id WHERE pc.pack_id=? ORDER BY pc.sort_order,c.created_at`).bind(pack.id).all<CardRow>();
    output.push({ ...pack,cards:cards.results.map((card) => ({ ...card,imageUrl:imageUrl(card) })) });
  }
  return output;
}

export async function getCollection(email:string):Promise<SharedCard[]> {
  const rows=await getRawDb().prepare(`SELECT c.id,c.name,c.position,c.country,c.team,c.number,c.rating,c.rarity,c.series,c.card_type AS cardType,c.season,c.image_key AS imageKey,col.quantity
    FROM cards c JOIN collection col ON col.card_id=c.id WHERE col.user_email=? ORDER BY col.acquired_at DESC`).bind(email).all<CardRow>();
  return rows.results.map((card) => ({ ...card,imageUrl:imageUrl(card) }));
}

export function getImageStore() {
  const store=(env as unknown as RuntimeEnv).CARD_IMAGES;
  if (!store) throw new Error("KV binding `CARD_IMAGES` is unavailable.");
  return store;
}
