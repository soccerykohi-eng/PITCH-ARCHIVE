import { beginGoogleOAuth } from "@/app/google-auth";
import { getAdminAccessKey, requireAdmin } from "@/app/server-auth";
import { secretsEqual } from "@/app/session";
import { getRawDb } from "@/db";

export async function POST(request:Request) {
  const auth=await requireAdmin();if (!auth.member || auth.response) return auth.response;
  const body=await request.json().catch(() => null) as { accessKey?:string } | null;
  if (!(await secretsEqual(String(body?.accessKey ?? ""),getAdminAccessKey()))) return Response.json({ error:"アクセスキーを確認してください" },{ status:403 });
  if (await getRawDb().prepare("SELECT 1 FROM admin_google_identities LIMIT 1").first()) return Response.json({ error:"管理者Googleアカウントは連携済みです" },{ status:409 });
  const flow=await beginGoogleOAuth(request,{ mode:"admin-link",userEmail:auth.member.email },true);
  if (!flow) return Response.json({ error:"Google認証設定がありません" },{ status:500 });
  return Response.json({ url:flow.url },{ headers:{ "set-cookie":flow.cookie,"cache-control":"no-store" } });
}
