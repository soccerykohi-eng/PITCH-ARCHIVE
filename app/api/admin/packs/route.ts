import { requireAdmin } from "@/app/server-auth";
import { auditStatement } from "@/app/audit";
import { getRawDb } from "@/db";

export async function POST(request:Request) {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const body=await request.json().catch(() => null) as { name?:string;description?:string } | null;
  const name=String(body?.name ?? "").trim().slice(0,60);
  const description=String(body?.description ?? "").trim().slice(0,240);
  if (!name) return Response.json({ error:"パック名を入力してください" },{ status:400 });
  const id=crypto.randomUUID();
  const db=getRawDb();await db.batch([db.prepare("INSERT INTO packs (id,name,description,status,point_cost,created_at) VALUES (?,?,?,'draft',0,?)").bind(id,name,description,Date.now()),auditStatement(db,member.email,"pack.create","pack",id,name)]);
  return Response.json({ ok:true,id });
}
