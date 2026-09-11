import { auditStatement } from "@/app/audit";
import { requireAdmin } from "@/app/server-auth";
import { getRawDb } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { member,response }=await requireAdmin();if (!member || response) return response;
  const result=await getRawDb().prepare(`SELECT r.id,r.reporter_email AS reporterEmail,ru.display_name AS reporterName,r.target_email AS targetEmail,tu.display_name AS targetName,
    r.reason,r.details,r.status,r.created_at AS createdAt,r.resolved_at AS resolvedAt FROM reports r
    JOIN users ru ON ru.email=r.reporter_email JOIN users tu ON tu.email=r.target_email ORDER BY r.created_at DESC LIMIT 100`).all();
  return Response.json({ reports:result.results });
}

export async function PATCH(request:Request) {
  const { member,response }=await requireAdmin();if (!member || response) return response;
  const body=await request.json().catch(() => null) as { id?:string;status?:string } | null;
  const id=String(body?.id ?? "");const status=body?.status === "resolved" ? "resolved" : body?.status === "open" ? "open" : null;
  if (!id || !status) return Response.json({ error:"通報を確認してください" },{ status:400 });
  const db=getRawDb();
  await db.batch([
    db.prepare("UPDATE reports SET status=?,resolved_at=? WHERE id=?").bind(status,status === "resolved" ? Date.now() : null,id),
    auditStatement(db,member.email,"report.status","report",id,status),
  ]);
  return Response.json({ ok:true });
}
