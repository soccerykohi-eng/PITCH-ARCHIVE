import { requireAdmin } from "@/app/server-auth";
import { getRawDb } from "@/db";

export async function POST(_request:Request,{ params }:{ params:Promise<{ id:string }> }) {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const { id }=await params;
  const db=getRawDb();
  const source=await db.prepare("SELECT name,description FROM packs WHERE id = ?").bind(id).first<{ name:string;description:string }>();
  if (!source) return Response.json({ error:"パックが見つかりません" },{ status:404 });
  const newId=crypto.randomUUID();
  const newName=`${source.name}（複製）`.slice(0,60);
  await db.batch([
    db.prepare("INSERT INTO packs (id,name,description,status,point_cost,created_at) VALUES (?,?,?,'draft',0,?)").bind(newId,newName,source.description,Date.now()),
    db.prepare("INSERT INTO pack_cards (pack_id,card_id,sort_order) SELECT ?,card_id,sort_order FROM pack_cards WHERE pack_id = ?").bind(newId,id)
  ]);
  return Response.json({ ok:true,id:newId });
}
