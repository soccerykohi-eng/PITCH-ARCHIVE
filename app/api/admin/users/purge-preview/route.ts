import { requireAdmin } from "@/app/server-auth";
import { ADMIN_EMAIL,MAX_PURGE_USERS,getPurgePreview,getPurgeTargets,normalizePurgeEmails,type PurgeTarget } from "@/app/admin-user-purge";

export async function POST(request:Request) {
  const { member,response }=await requireAdmin();
  if (!member || response) return response;
  const body=await request.json().catch(() => null) as { emails?:unknown } | null;
  const emails=normalizePurgeEmails(body?.emails);
  if (!emails.length || emails.length > MAX_PURGE_USERS) return Response.json({ error:"削除対象は1〜50件で選択してください" },{ status:400 });
  const targets=await getPurgeTargets(emails);
  if (targets.length !== emails.length || targets.some((target:PurgeTarget) => target.role !== "player" || target.email === ADMIN_EMAIL || target.email === member.email)) {
    return Response.json({ error:"削除できないアカウントが含まれています" },{ status:400 });
  }
  return Response.json(await getPurgePreview(emails));
}
