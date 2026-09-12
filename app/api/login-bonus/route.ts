import { requireApprovedMember } from "@/app/server-auth";
import { getRawDb } from "@/db";

export const dynamic = "force-dynamic";

const LOGIN_BONUS = 30;
const JST_OFFSET = 9 * 60 * 60 * 1000;

function dateKey(now = Date.now()) {
  const date = new Date(now + JST_OFFSET);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

async function getState(email: string) {
  const db = getRawDb();
  const today = dateKey();
  const [claim, user] = await Promise.all([
    db.prepare("SELECT 1 FROM mission_reward_claims WHERE user_email=? AND period_key=? AND reward_key='login' LIMIT 1")
      .bind(email, today).first(),
    db.prepare("SELECT points FROM users WHERE email=?").bind(email).first<{ points: number }>(),
  ]);
  const claimed = Boolean(claim);
  return {
    date: today,
    reward: LOGIN_BONUS,
    claimed,
    available: !claimed,
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
  const today = dateKey();
  const inserted = await db.prepare(`INSERT OR IGNORE INTO mission_reward_claims
    (user_email,period_key,reward_key,claimed_at) VALUES (?,?,'login',?) RETURNING reward_key`)
    .bind(member.email, today, Date.now()).first();
  if (!inserted)
    return Response.json({ error: "今日のログインボーナスは受取済みです" }, { status: 409 });

  await db.prepare("UPDATE users SET points=points+? WHERE email=?").bind(LOGIN_BONUS, member.email).run();
  return Response.json({ ok: true, reward: LOGIN_BONUS });
}
