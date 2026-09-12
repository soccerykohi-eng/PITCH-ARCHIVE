import { requireAdmin } from "@/app/server-auth";
import { auditStatement } from "@/app/audit";
import { getImageStore } from "@/app/server-data";
import { getRawDb } from "@/db";

type Rarity="CORE"|"RARE"|"ELITE"|"ICON";

const RARITY_ALIASES:Record<string,Rarity>={
  BASE:"CORE",COMMON:"CORE",STANDARD:"CORE",CORE:"CORE",
  RARE:"RARE",ROOKIE:"RARE",
  ELITE:"ELITE",EPIC:"ELITE",MOMENT:"ELITE",JERSEY:"ELITE",
  ICON:"ICON",LEGEND:"ICON",LEGENDARY:"ICON",SIGNATURE:"ICON",
};

function safeCardId(value:unknown) {
  const normalized=String(value ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,100);
  return normalized || `card-${crypto.randomUUID()}`;
}

function parseMeta(raw:string) {
  const cleaned=raw.replace(/&#(?:x20|32);/gi," ").replace(/&nbsp;/gi," ").replace(/```(?:json)?/gi,"").replace(/```/g,"").trim();
  const start=cleaned.indexOf("{");
  const end=cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("JSONが見つかりません");
  const value=JSON.parse(cleaned.slice(start,end+1));
  if (value.schema && value.schema !== "pitch-archive-card-v1") throw new Error("schemaは pitch-archive-card-v1 にしてください");
  if (!String(value.name ?? "").trim()) throw new Error("JSONに選手名 name がありません");
  const cardType=String(value.cardType ?? "BASE").trim().toUpperCase();
  const rarityInput=String(value.rarity ?? "").trim().toUpperCase();
  const rarity=RARITY_ALIASES[rarityInput] ?? RARITY_ALIASES[cardType] ?? "RARE";
  const rawNumber=value.number;
  return {
    id:safeCardId(value.id),name:String(value.name).trim().slice(0,80),position:String(value.position ?? "").trim().slice(0,40),country:String(value.country ?? "").trim().slice(0,60),team:String(value.team ?? "").trim().slice(0,80),number:rawNumber !== null && rawNumber !== "" && Number.isInteger(Number(rawNumber)) ? Number(rawNumber) : null,rating:Math.max(70,Math.min(99,Number(value.rating) || 80)),rarity,series:String(value.series ?? "PITCH ARCHIVE").trim().slice(0,80),cardType:cardType.slice(0,40),season:String(value.season ?? "—").trim().slice(0,50)
  };
}

const MAX_CHUNK_BYTES=220 * 1024;
const MAX_CHUNKS=64;
const MAX_IMAGE_BYTES=10 * 1024 * 1024;

function validUploadId(value:string) {
  return /^[a-f0-9-]{36}$/i.test(value);
}

function chunkKey(packId:string,uploadId:string,index:number) {
  return `temp/card-uploads/${packId}/${uploadId}/${index}`;
}

async function requirePack(packId:string) {
  return getRawDb().prepare("SELECT id,status FROM packs WHERE id = ?").bind(packId).first<{ id:string;status:string }>();
}

async function saveCard(packId:string,meta:ReturnType<typeof parseMeta>,bytes:ArrayBuffer | Uint8Array,contentType:string,actorEmail:string) {
  const old=await getRawDb().prepare("SELECT image_key AS imageKey FROM cards WHERE id = ?").bind(meta.id).first<{ imageKey:string }>();
  const extension=contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const imageKey=`cards/${meta.id}/${crypto.randomUUID()}.${extension}`;
  await getImageStore().put(imageKey,bytes,{ metadata:{ contentType } });
  try {
    const db=getRawDb();
    await db.batch([
      db.prepare(`INSERT INTO cards (id,name,position,country,team,number,rating,rarity,series,card_type,season,image_key,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,position=excluded.position,country=excluded.country,team=excluded.team,number=excluded.number,rating=excluded.rating,rarity=excluded.rarity,series=excluded.series,card_type=excluded.card_type,season=excluded.season,image_key=excluded.image_key`).bind(meta.id,meta.name,meta.position,meta.country,meta.team,meta.number,meta.rating,meta.rarity,meta.series,meta.cardType,meta.season,imageKey,Date.now()),
      db.prepare("INSERT OR IGNORE INTO pack_cards (pack_id,card_id,sort_order) VALUES (?,?,(SELECT COUNT(*) FROM pack_cards WHERE pack_id=?))").bind(packId,meta.id,packId),
      auditStatement(db,actorEmail,old ? "card.update" : "card.create","card",meta.id,`${meta.name} / ${packId}`)
    ]);
  } catch (error) {
    await getImageStore().delete(imageKey);
    throw error;
  }
  if (old?.imageKey && !old.imageKey.startsWith("/")) await getImageStore().delete(old.imageKey);
  return meta.id;
}

export async function PATCH(request:Request,{ params }:{ params:Promise<{ id:string }> }) {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const { id:packId }=await params;
  const pack=await requirePack(packId);
  if (!pack) return Response.json({ error:"パックが見つかりません" },{ status:404 });
  if (pack.status !== "draft") return Response.json({ error:"収録カードを変更できるのは下書きだけです" },{ status:409 });
  const body=await request.json().catch(() => null) as { action?:unknown;cardId?:unknown } | null;
  const action=body?.action === "add" ? "add" : body?.action === "remove" ? "remove" : null;
  const cardId=String(body?.cardId ?? "");
  if (!action || !cardId) return Response.json({ error:"変更内容が正しくありません" },{ status:400 });
  const db=getRawDb();
  if (action === "add") {
    const card=await db.prepare("SELECT id FROM cards WHERE id = ?").bind(cardId).first();
    if (!card) return Response.json({ error:"カードが見つかりません" },{ status:404 });
    await db.batch([db.prepare("INSERT OR IGNORE INTO pack_cards (pack_id,card_id,sort_order) VALUES (?,?,(SELECT COUNT(*) FROM pack_cards WHERE pack_id=?))").bind(packId,cardId,packId),auditStatement(db,member.email,"pack.card.add","card",cardId,packId)]);
  } else {
    await db.batch([db.prepare("DELETE FROM pack_cards WHERE pack_id = ? AND card_id = ?").bind(packId,cardId),auditStatement(db,member.email,"pack.card.remove","card",cardId,packId)]);
  }
  return Response.json({ ok:true });
}

export async function PUT(request:Request,{ params }:{ params:Promise<{ id:string }> }) {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const { id:packId }=await params;
  const pack=await requirePack(packId);
  if (!pack) return Response.json({ error:"パックが見つかりません" },{ status:404 });
  if (pack.status !== "draft") return Response.json({ error:"カードを追加できるのは下書きパックだけです" },{ status:409 });
  try {
    const form=await request.formData();
    const uploadId=String(form.get("uploadId") ?? "");
    const index=Number(form.get("index"));
    const chunk=form.get("chunk");
    if (!validUploadId(uploadId) || !Number.isInteger(index) || index < 0 || index >= MAX_CHUNKS) throw new Error("画像の送信情報が正しくありません");
    if (!(chunk instanceof File) || chunk.size === 0 || chunk.size > MAX_CHUNK_BYTES) throw new Error("画像データが大きすぎます");
    await getImageStore().put(chunkKey(packId,uploadId,index),await chunk.arrayBuffer());
    return Response.json({ ok:true,index });
  } catch (error) {
    return Response.json({ error:error instanceof Error ? error.message : "画像を送信できませんでした" },{ status:400 });
  }
}

export async function POST(request:Request,{ params }:{ params:Promise<{ id:string }> }) {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const { id:packId }=await params;
  const pack=await requirePack(packId);
  if (!pack) return Response.json({ error:"パックが見つかりません" },{ status:404 });
  if (pack.status !== "draft") return Response.json({ error:"カードを追加できるのは下書きパックだけです" },{ status:409 });
  try {
    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      const body=await request.json() as { uploadId?:unknown;totalChunks?:unknown;json?:unknown;contentType?:unknown };
      const uploadId=String(body.uploadId ?? "");
      const totalChunks=Number(body.totalChunks);
      const contentType=String(body.contentType ?? "").toLowerCase() === "image/jpg" ? "image/jpeg" : String(body.contentType ?? "").toLowerCase();
      if (!validUploadId(uploadId) || !Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > MAX_CHUNKS) throw new Error("画像の送信情報が正しくありません");
      if (!["image/jpeg","image/png","image/webp"].includes(contentType)) throw new Error("JPEG・PNG・WebP画像を選択してください");
      const meta=parseMeta(String(body.json ?? ""));
      const parts:ArrayBuffer[]=[];
      let totalBytes=0;
      for (let index=0;index<totalChunks;index++) {
        const object=await getImageStore().get(chunkKey(packId,uploadId,index),"arrayBuffer");
        if (!object) throw new Error(`画像データが不足しています（${index+1}/${totalChunks}）`);
        const part=object;
        totalBytes+=part.byteLength;
        if (totalBytes > MAX_IMAGE_BYTES) throw new Error("画像データが大きすぎます");
        parts.push(part);
      }
      const combined=new Uint8Array(totalBytes);
      let offset=0;
      for (const part of parts) { combined.set(new Uint8Array(part),offset);offset+=part.byteLength; }
      const cardId=await saveCard(packId,meta,combined,contentType,member.email);
      await Promise.all(Array.from({ length:totalChunks },(_,index) => getImageStore().delete(chunkKey(packId,uploadId,index))));
      return Response.json({ ok:true,id:cardId });
    }
    const form=await request.formData();
    const file=form.get("image");
    const json=String(form.get("json") ?? "");
    if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024) return Response.json({ error:"10MB以下の画像を選択してください" },{ status:400 });
    const declaredType=file.type.toLowerCase();
    const extensionFromName=file.name.toLowerCase().split(".").pop();
    const contentType=declaredType === "image/jpg" ? "image/jpeg" : declaredType || (extensionFromName === "png" ? "image/png" : extensionFromName === "webp" ? "image/webp" : extensionFromName === "jpg" || extensionFromName === "jpeg" ? "image/jpeg" : "");
    if (!["image/jpeg","image/png","image/webp"].includes(contentType)) return Response.json({ error:"JPEG・PNG・WebP画像を選択してください" },{ status:400 });
    const meta=parseMeta(json);
    const cardId=await saveCard(packId,meta,await file.arrayBuffer(),contentType,member.email);
    return Response.json({ ok:true,id:cardId });
  } catch (error) {
    return Response.json({ error:error instanceof Error ? error.message : "カードを追加できませんでした" },{ status:400 });
  }
}
