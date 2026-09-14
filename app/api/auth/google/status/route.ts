import { getSessionIdentity } from "@/app/server-auth";
import { getRawDb } from "@/db";

export async function GET() {
  const identity=await getSessionIdentity();
  if (identity?.kind !== "guest") return Response.json({ error:"プレイヤーセッションが必要です" },{ status:401 });
  const linked=await getRawDb().prepare("SELECT google_email AS googleEmail FROM google_identities WHERE user_email=?").bind(identity.email).first<{ googleEmail:string | null }>();
  return Response.json({ linked:Boolean(linked),email:linked?.googleEmail ?? null },{ headers:{ "cache-control":"no-store" } });
}
