import { requireAdmin } from "@/app/server-auth";
import { getRawDb } from "@/db";

export async function GET() {
  const auth=await requireAdmin();if (!auth.member || auth.response) return auth.response;
  const identity=await getRawDb().prepare("SELECT google_email AS googleEmail FROM admin_google_identities WHERE admin_email=?").bind(auth.member.email).first<{ googleEmail:string | null }>();
  return Response.json({ linked:Boolean(identity),email:identity?.googleEmail ?? null });
}
