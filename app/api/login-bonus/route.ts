import { requireApprovedMember } from "@/app/server-auth";
import { calculateLoginBonus, loginBonusDateKey } from "@/app/login-bonus";
import { getRawDb } from "@/db";

export const dynamic = "force-dynamic";

async function getState(email: string, now = Date.now()) {
  const db = getRawDb();
  const today = loginBonusDateKey(now);
  const [claims, user] = await Promise.all([
    db.prepare("SELECT period_key AS periodKey FROM mission_reward_claims WHERE user_email=? AND reward_key='login' ORDER BY period_key DESC")
      .bind(email).all<{ periodKey: string }>(),
    db.prepare("SELECT points FROM users WHERE email=?").bind(email).first<{ points: number }>(),
  ]);
  return {
    date: today,
    ...calculateLoginBonus(today, claims.results.map((claim: { periodKey: string }) => claim.periodKey)),
    points: user?.points ?? 0,
  };
}

export async function GET() {
  const { member, response } = await requireApprovedMember();
  if (!member || response) return response;
  return Response.json(await getState(member.email));
}

export async function POST(request: Request) {
  const { member, response } = await requireApprovedMember();
  if (!member || response) return response;
  const body = await request.json().catch(() => ({})) as { action?: string };
  if (body.action !== "claim")
    return Response.json({ error: "ログインボーナスを受け取れませんでした" }, { status: 400 });

  const db = getRawDb();
  const now = Date.now();
  const state = await getState(member.email, now);
  const today = state.date;
  const inserted = await db.prepare(`INSERT OR IGNORE INTO mission_reward_claims
    (user_email,period_key,reward_key,claimed_at) VALUES (?,?,'login',?) RETURNING reward_key`)
    .bind(member.email, today, now).first();
  if (!inserted)
    return Response.json({ error: "今日のログインボーナスは受取済みです" }, { status: 409 });

  await db.prepare("UPDATE users SET points=points+? WHERE email=?").bind(state.reward, member.email).run();
  return Response.json({ ok: true, reward: state.reward });
}
