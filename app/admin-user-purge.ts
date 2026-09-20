import { getRawDb } from "@/db";

export const ADMIN_EMAIL="admin@pitcharchive.local";
export const MAX_PURGE_USERS=50;

export type PurgePreview = {
  userCount:number;
  googleLinkedCount:number;
  cardCopies:number;
  packOpenings:number;
  friendRelations:number;
  trades:number;
  notifications:number;
  pointsTotal:number;
};
export type PurgeTarget = { email:string;role:string;avatarKey:string|null;googleLinked:number };

export function normalizePurgeEmails(input:unknown) {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map((value) => String(value).trim().toLowerCase()).filter(Boolean)));
}

export function placeholders(count:number) {
  return Array.from({ length:count },() => "?").join(",");
}

export async function getPurgeTargets(emails:string[]) {
  const marks=placeholders(emails.length);
  const result=await getRawDb().prepare(`SELECT u.email,u.role,u.avatar_key AS avatarKey,
    CASE WHEN gi.user_email IS NULL THEN 0 ELSE 1 END AS googleLinked
    FROM users u LEFT JOIN google_identities gi ON gi.user_email=u.email
    WHERE u.email IN (${marks})`).bind(...emails).all<PurgeTarget>();
  return result.results as PurgeTarget[];
}

export async function getPurgePreview(emails:string[]):Promise<PurgePreview> {
  const marks=placeholders(emails.length);
  const db=getRawDb();
  const bind=(sql:string,repeats=1) => db.prepare(sql.replaceAll("__EMAILS__",marks)).bind(...Array.from({ length:repeats },() => emails).flat());
  const [users,cards,openings,friends,trades,notifications]=await Promise.all([
    bind(`SELECT COUNT(*) AS userCount,COALESCE(SUM(u.points),0) AS pointsTotal,
      COALESCE(SUM(CASE WHEN gi.user_email IS NULL THEN 0 ELSE 1 END),0) AS googleLinkedCount
      FROM users u LEFT JOIN google_identities gi ON gi.user_email=u.email WHERE u.email IN (__EMAILS__)`).first<{ userCount:number;pointsTotal:number;googleLinkedCount:number }>(),
    bind("SELECT COALESCE(SUM(quantity),0) AS total FROM collection WHERE user_email IN (__EMAILS__)").first<{ total:number }>(),
    bind(`SELECT
      (SELECT COUNT(*) FROM pack_openings WHERE user_email IN (__EMAILS__))+
      (SELECT COUNT(*) FROM pack_claims WHERE user_email IN (__EMAILS__)) AS total`,2).first<{ total:number }>(),
    bind("SELECT COUNT(*) AS total FROM friendships WHERE user_a_email IN (__EMAILS__) OR user_b_email IN (__EMAILS__)",2).first<{ total:number }>(),
    bind("SELECT COUNT(*) AS total FROM trades WHERE proposer_email IN (__EMAILS__) OR recipient_email IN (__EMAILS__)",2).first<{ total:number }>(),
    bind("SELECT COUNT(*) AS total FROM notifications WHERE user_email IN (__EMAILS__)").first<{ total:number }>(),
  ]);
  return {
    userCount:Number(users?.userCount ?? 0),
    googleLinkedCount:Number(users?.googleLinkedCount ?? 0),
    cardCopies:Number(cards?.total ?? 0),
    packOpenings:Number(openings?.total ?? 0),
    friendRelations:Number(friends?.total ?? 0),
    trades:Number(trades?.total ?? 0),
    notifications:Number(notifications?.total ?? 0),
    pointsTotal:Number(users?.pointsTotal ?? 0),
  };
}
