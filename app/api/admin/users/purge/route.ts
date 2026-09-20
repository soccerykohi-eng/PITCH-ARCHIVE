import { auditStatement } from "@/app/audit";
import { ADMIN_EMAIL,MAX_PURGE_USERS,getPurgePreview,getPurgeTargets,normalizePurgeEmails,placeholders,type PurgeTarget } from "@/app/admin-user-purge";
import { requireAdmin } from "@/app/server-auth";
import { getImageStore } from "@/app/server-data";
import { getRawDb } from "@/db";

export async function POST(request:Request) {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const body=await request.json().catch(() => null) as { emails?:unknown;confirmation?:unknown } | null;
  const emails=normalizePurgeEmails(body?.emails);
  if (!emails.length || emails.length > MAX_PURGE_USERS) return Response.json({ error:"削除対象は1〜50件で選択してください" },{ status:400 });
  if (body?.confirmation !== `DELETE ${emails.length} ACCOUNTS`) return Response.json({ error:"確認文字列が一致しません" },{ status:400 });

  const targets=await getPurgeTargets(emails);
  if (targets.length !== emails.length || targets.some((target:PurgeTarget) => target.role !== "player" || target.email === ADMIN_EMAIL || target.email === member.email)) {
    return Response.json({ error:"削除できないアカウントが含まれています" },{ status:400 });
  }
  if (targets.some((target:PurgeTarget) => target.googleLinked)) {
    return Response.json({ error:"対象アカウントの状態が変更されました。もう一度確認してください。" },{ status:409 });
  }

  const preview=await getPurgePreview(emails);
  const marks=placeholders(emails.length);
  const db=getRawDb();
  await db.batch([
    db.prepare(`DELETE FROM announcements WHERE created_by IN (${marks})`).bind(...emails),
    db.prepare(`DELETE FROM audit_logs WHERE actor_email IN (${marks})`).bind(...emails),
    db.prepare(`DELETE FROM audit_logs WHERE target_type='user' AND target_id IN (${marks})`).bind(...emails),
    db.prepare(`DELETE FROM users WHERE role='player' AND email IN (${marks})`).bind(...emails),
    auditStatement(db,member.email,"user.bulk_purge","user","bulk",JSON.stringify(preview)),
  ]);
  await Promise.all(targets.flatMap((target:PurgeTarget) => target.avatarKey ? [getImageStore().delete(`avatars/${target.avatarKey}`).catch(() => undefined)] : []));
  return Response.json({ ok:true,...preview });
}
