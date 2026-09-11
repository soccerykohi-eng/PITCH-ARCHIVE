import { requireAdmin } from "@/app/server-auth";
import { getRawDb } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(request:Request) {
  const { member,response }=await requireAdmin();if (!member || response) return response;
  const url=new URL(request.url);const query=String(url.searchParams.get("q") ?? "").trim();
  const pattern=`%${query}%`;
  const result=await getRawDb().prepare(`SELECT id,actor_email AS actorEmail,action,target_type AS targetType,target_id AS targetId,detail,created_at AS createdAt
    FROM audit_logs WHERE ?='' OR actor_email LIKE ? OR action LIKE ? OR target_id LIKE ? OR detail LIKE ? ORDER BY created_at DESC LIMIT 100`)
    .bind(query,pattern,pattern,pattern,pattern).all();
  return Response.json({ logs:result.results });
}
