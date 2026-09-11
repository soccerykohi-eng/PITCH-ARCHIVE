import { auditStatement } from "@/app/audit";
import { requireApprovedMember } from "@/app/server-auth";
import { getRawDb } from "@/db";

export const dynamic = "force-dynamic";

function pair(first:string,second:string) { return first < second ? [first,second] as const : [second,first] as const; }

export async function GET() {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const result=await getRawDb().prepare(`SELECT b.blocked_email AS email,u.display_name AS displayName,u.avatar_key AS avatarKey
    FROM blocks b JOIN users u ON u.email=b.blocked_email WHERE b.blocker_email=? ORDER BY b.created_at DESC`).bind(member.email).all<{ email:string;displayName:string;avatarKey:string|null }>();
  return Response.json({ blockedPeople:result.results.map(({ avatarKey,...item }) => ({ ...item,avatarUrl:avatarKey ? `/api/avatar/${encodeURIComponent(avatarKey)}` : null })) });
}

export async function POST(request:Request) {
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const body=await request.json().catch(() => null) as { action?:string;targetEmail?:string;reason?:string;details?:string } | null;
  const action=String(body?.action ?? "");const targetEmail=String(body?.targetEmail ?? "").trim().toLowerCase();
  if (!targetEmail || targetEmail === member.email) return Response.json({ error:"参加者を確認してください" },{ status:400 });
  const db=getRawDb();const target=await db.prepare("SELECT email FROM users WHERE email=? AND status='approved'").bind(targetEmail).first();
  if (!target) return Response.json({ error:"参加者が見つかりません" },{ status:404 });
  const now=Date.now();
  if (action === "block") {
    const [userA,userB]=pair(member.email,targetEmail);
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO blocks (blocker_email,blocked_email,created_at) VALUES (?,?,?)").bind(member.email,targetEmail,now),
      db.prepare("DELETE FROM friendships WHERE user_a_email=? AND user_b_email=?").bind(userA,userB),
      db.prepare("UPDATE trades SET status='cancelled',updated_at=? WHERE status='pending' AND ((proposer_email=? AND recipient_email=?) OR (proposer_email=? AND recipient_email=?))").bind(now,member.email,targetEmail,targetEmail,member.email),
      auditStatement(db,member.email,"user.block","user",targetEmail),
    ]);
    return Response.json({ ok:true });
  }
  if (action === "unblock") {
    await db.batch([db.prepare("DELETE FROM blocks WHERE blocker_email=? AND blocked_email=?").bind(member.email,targetEmail),auditStatement(db,member.email,"user.unblock","user",targetEmail)]);
    return Response.json({ ok:true });
  }
  if (action === "report") {
    const reason=String(body?.reason ?? "").trim();const details=String(body?.details ?? "").trim();
    if (!reason) return Response.json({ error:"通報理由を選択してください" },{ status:400 });
    await db.batch([
      db.prepare("INSERT INTO reports (id,reporter_email,target_email,reason,details,status,created_at) VALUES (?,?,?,?,?,'open',?)").bind(crypto.randomUUID(),member.email,targetEmail,reason,details.slice(0,300),now),
      auditStatement(db,member.email,"user.report","user",targetEmail,reason),
    ]);
    return Response.json({ ok:true });
  }
  return Response.json({ error:"操作を確認してください" },{ status:400 });
}
