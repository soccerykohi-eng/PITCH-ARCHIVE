import { passkeyCount } from "@/app/passkey";
import { getSessionIdentity, requireApprovedMember } from "@/app/server-auth";

export async function GET() {
  const identity=await getSessionIdentity();
  if (identity?.kind !== "guest") return Response.json({ error:"プレイヤーセッションが必要です" },{ status:401 });
  const { member,response }=await requireApprovedMember();
  if (!member || response) return response;
  const count=await passkeyCount(member.email);
  return Response.json({ configured:count > 0,count },{ headers:{ "cache-control":"no-store" } });
}
