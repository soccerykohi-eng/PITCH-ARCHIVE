import { getRawDb } from "@/db";
import type { Dashboard, DashboardUser } from "./dashboard-types";
import type { AppMember } from "./server-auth";
import { getCollection, getPacksForUser } from "./server-data";

type DashboardUserRow = Omit<DashboardUser, "avatarUrl"> & { avatarKey: string | null };

export async function getDashboardData(member: AppMember): Promise<Dashboard> {
  if (member.status !== "approved") return { session:member,packs:[],collection:[],users:[] };

  const db=getRawDb();
  await db.prepare("DELETE FROM cards WHERE id IN ('haaland','zakaria','nuno')").run();
  if (member.role === "admin") {
    await db.prepare("DELETE FROM collection WHERE user_email = ? AND card_id = 'bellingham-noble' AND source_pack_id IS NULL").bind(member.email).run();
  }

  const [packs,collection]=await Promise.all([
    getPacksForUser(member.email,member.role === "admin"),
    getCollection(member.email),
  ]);
  let users:DashboardUser[]=[];
  if (member.role === "admin") {
    const result=await db.prepare(`SELECT u.email,u.display_name AS displayName,u.avatar_key AS avatarKey,u.role,u.status,u.points,u.last_seen_at AS lastSeenAt,u.created_at AS createdAt,
      CASE WHEN gi.user_email IS NULL THEN 0 ELSE 1 END AS googleLinked,
      COALESCE((SELECT SUM(c.quantity) FROM collection c WHERE c.user_email=u.email),0) AS cardCount,
      ((SELECT COUNT(*) FROM pack_openings po WHERE po.user_email=u.email)+(SELECT COUNT(*) FROM pack_claims pc WHERE pc.user_email=u.email)) AS packOpeningCount,
      (SELECT COUNT(*) FROM friendships f WHERE f.user_a_email=u.email OR f.user_b_email=u.email) AS friendCount,
      (SELECT COUNT(*) FROM trades t WHERE t.proposer_email=u.email OR t.recipient_email=u.email) AS tradeCount
      FROM users u LEFT JOIN google_identities gi ON gi.user_email=u.email ORDER BY u.created_at DESC`).all<DashboardUserRow>();
    users=result.results.map(({ avatarKey,...user }:DashboardUserRow) => ({ ...user,avatarUrl:avatarKey ? `/api/avatar/${encodeURIComponent(avatarKey)}` : null }));
  }
  return { session:member,packs,collection,users };
}
