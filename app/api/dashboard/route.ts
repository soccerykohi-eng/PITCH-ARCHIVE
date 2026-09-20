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
    const result=await getRawDb().prepare(`SELECT u.email,u.display_name AS displayName,u.avatar_key AS avatarKey,u.role,u.status,u.points,u.last_seen_at AS lastSeenAt,u.created_at AS createdAt,
      CASE WHEN gi.user_email IS NULL THEN 0 ELSE 1 END AS googleLinked,
      COALESCE((SELECT SUM(c.quantity) FROM collection c WHERE c.user_email=u.email),0) AS cardCount,
      ((SELECT COUNT(*) FROM pack_openings po WHERE po.user_email=u.email)+(SELECT COUNT(*) FROM pack_claims pc WHERE pc.user_email=u.email)) AS packOpeningCount,
      (SELECT COUNT(*) FROM friendships f WHERE f.user_a_email=u.email OR f.user_b_email=u.email) AS friendCount,
      (SELECT COUNT(*) FROM trades t WHERE t.proposer_email=u.email OR t.recipient_email=u.email) AS tradeCount
      FROM users u LEFT JOIN google_identities gi ON gi.user_email=u.email ORDER BY u.created_at DESC`).all<{ email:string;displayName:string;avatarKey:string|null;role:string;status:string;points:number;lastSeenAt:number|null;createdAt:number;googleLinked:number;cardCount:number;packOpeningCount:number;friendCount:number;tradeCount:number }>();
    users=result.results.map(({ avatarKey,...user }:{ email:string;displayName:string;avatarKey:string|null;role:string;status:string;points:number;lastSeenAt:number|null;createdAt:number;googleLinked:number;cardCount:number;packOpeningCount:number;friendCount:number;tradeCount:number }) => ({ ...user,avatarUrl:avatarKey ? `/api/avatar/${encodeURIComponent(avatarKey)}` : null }));
  }
  return Response.json({ session:member,packs,collection,users });
}
