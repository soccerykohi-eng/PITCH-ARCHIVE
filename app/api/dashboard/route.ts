import { requireMember } from "@/app/server-auth";
import { getCollection, getPacksForUser } from "@/app/server-data";
import { getRawDb } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { member,response }=await requireMember();
  if (!member || response) return response;
  if (member.status !== "approved") return Response.json({ session:member,packs:[],collection:[],users:[] });
  await getRawDb().prepare("DELETE FROM cards WHERE id IN ('haaland','zakaria','nuno')").run();
  if (member.role === "admin") {
    await getRawDb().prepare("DELETE FROM collection WHERE user_email = ? AND card_id = 'bellingham-noble' AND source_pack_id IS NULL").bind(member.email).run();
  }
  const [packs,collection]=await Promise.all([getPacksForUser(member.email,member.role === "admin"),getCollection(member.email)]);
  let users:unknown[]=[];
  if (member.role === "admin") {
    const result=await getRawDb().prepare(`SELECT u.email,u.display_name AS displayName,u.avatar_key AS avatarKey,u.role,u.status,u.created_at AS createdAt,
      (SELECT COUNT(*) FROM friendships f WHERE f.status='accepted' AND (f.user_a_email=u.email OR f.user_b_email=u.email)) AS friendCount,
      (SELECT COUNT(*) FROM trades t WHERE t.status='accepted' AND (t.proposer_email=u.email OR t.recipient_email=u.email)) AS tradeCount
      FROM users u ORDER BY u.created_at DESC`).all<{ email:string;displayName:string;avatarKey:string|null;role:string;status:string;createdAt:number;friendCount:number;tradeCount:number }>();
    users=result.results.map(({ avatarKey,...user }) => ({ ...user,avatarUrl:avatarKey ? `/api/avatar/${encodeURIComponent(avatarKey)}` : null }));
  }
  return Response.json({ session:member,packs,collection,users });
}
