import { requireAdmin } from "@/app/server-auth";
import { auditStatement } from "@/app/audit";
import { getImageStore } from "@/app/server-data";
import { getRawDb } from "@/db";

export async function PATCH(request:Request) {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const body=await request.json().catch(() => null) as { email?:string;status?:string;action?:string } | null;
  const email=String(body?.email ?? "").trim().toLowerCase();
  const status=body?.status === "approved" ? "approved" : body?.status === "pending" ? "pending" : body?.status === "suspended" ? "suspended" : null;
  if (!email || email === member.email) return Response.json({ error:"変更内容が正しくありません" },{ status:400 });
  const db=getRawDb();
  if (body?.action === "reset-profile") {
    const current=await db.prepare("SELECT avatar_key AS avatarKey FROM users WHERE email=? AND role='player'").bind(email).first<{ avatarKey:string|null }>();
    await db.batch([
      db.prepare("UPDATE users SET display_name='参加者',avatar_key=NULL WHERE email=? AND role='player'").bind(email),
      auditStatement(db,member.email,"profile.reset","user",email),
    ]);
    if (current?.avatarKey) await getImageStore().delete(`avatars/${current.avatarKey}`).catch(() => undefined);
    return Response.json({ ok:true });
  }
  if (!status) return Response.json({ error:"変更内容が正しくありません" },{ status:400 });
  if (status === "approved") {
    await db.batch([
      db.prepare("UPDATE users SET status = ? WHERE email = ? AND role = 'player'").bind(status,email),
      auditStatement(db,member.email,"user.status","user",email,status),
    ]);
  } else await db.batch([db.prepare("UPDATE users SET status = ? WHERE email = ? AND role = 'player'").bind(status,email),auditStatement(db,member.email,"user.status","user",email,status)]);
  return Response.json({ ok:true });
}
