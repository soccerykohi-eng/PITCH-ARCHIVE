import { requireAdmin } from "@/app/server-auth";
import { auditStatement } from "@/app/audit";
import { getRawDb } from "@/db";

export async function PATCH(request:Request,{ params }:{ params:Promise<{ id:string }> }) {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const { id }=await params;
  const body=await request.json().catch(() => null) as { name?:unknown;description?:unknown } | null;
  const name=String(body?.name ?? "").trim().slice(0,60);
  const description=String(body?.description ?? "").trim().slice(0,240);
  if (!name) return Response.json({ error:"リリース名を入力してください" },{ status:400 });
  const pack=await getRawDb().prepare("SELECT status FROM packs WHERE id = ?").bind(id).first<{ status:string }>();
  if (!pack) return Response.json({ error:"パックが見つかりません" },{ status:404 });
  if (pack.status !== "draft") return Response.json({ error:"基本情報を編集できるのは下書きだけです" },{ status:409 });
  const db=getRawDb();await db.batch([db.prepare("UPDATE packs SET name = ?, description = ? WHERE id = ?").bind(name,description,id),auditStatement(db,member.email,"pack.update","pack",id,name)]);
  return Response.json({ ok:true });
}

export async function DELETE(_request:Request,{ params }:{ params:Promise<{ id:string }> }) {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const { id }=await params;
  const db=getRawDb();
  const pack=await db.prepare("SELECT status FROM packs WHERE id = ?").bind(id).first<{ status:string }>();
  if (!pack) return Response.json({ error:"パックが見つかりません" },{ status:404 });
  if (pack.status === "published") return Response.json({ error:"公開中のパックは先に公開を終了してください" },{ status:409 });
  await db.batch([
    db.prepare("DELETE FROM pack_claims WHERE pack_id = ?").bind(id),
    db.prepare("UPDATE collection SET source_pack_id = NULL WHERE source_pack_id = ?").bind(id),
    db.prepare("DELETE FROM pack_cards WHERE pack_id = ?").bind(id),
    db.prepare("DELETE FROM packs WHERE id = ?").bind(id),
    auditStatement(db,member.email,"pack.delete","pack",id)
  ]);
  return Response.json({ ok:true });
}
