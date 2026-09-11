import { syncPackSchedule } from "@/app/pack-schedule";
import { requireApprovedMember } from "@/app/server-auth";
import { getRawDb } from "@/db";

const JST_OFFSET = 9 * 60 * 60 * 1000;
const REWARDS = { login: 30, card_views: 50, pack_activity: 100, daily_complete: 100, weekly_bonus: 300 } as const;
type DailyRewardKey = "login" | "card_views" | "pack_activity" | "daily_complete";
type RewardKey = DailyRewardKey | "weekly_bonus";

function jstParts(now = Date.now()) {
  const date = new Date(now + JST_OFFSET);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
}

function dateKey(now = Date.now()) {
  const { year, month, day } = jstParts(now);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dayStart(now = Date.now()) {
  const { year, month, day } = jstParts(now);
  return Date.UTC(year, month, day) - JST_OFFSET;
}

function weekStartKey(now = Date.now()) {
  const start = dayStart(now);
  const weekday = new Date(start + JST_OFFSET).getUTCDay();
  return dateKey(start - ((weekday + 6) % 7) * 86_400_000);
}

async function getState(email: string) {
  const db = getRawDb();
  const today = dateKey();
  const start = dayStart();
  await syncPackSchedule();
  await db.prepare(`INSERT OR IGNORE INTO daily_mission_events
    (user_email,event_date,event_type,reference_id,created_at) VALUES (?,?,?,?,?)`)
    .bind(email, today, "login", "daily", Date.now()).run();

  const [eventCounts, activePack, opening, claimRows, weeklyRows, user] = await Promise.all([
    db.prepare(`SELECT
      COUNT(DISTINCT CASE WHEN event_type='login' THEN reference_id END) AS loginCount,
      COUNT(DISTINCT CASE WHEN event_type='card_view' THEN reference_id END) AS cardViews,
      COUNT(DISTINCT CASE WHEN event_type='past_pack_view' THEN reference_id END) AS pastPackViews
      FROM daily_mission_events WHERE user_email=? AND event_date=?`).bind(email, today).first<Record<string, number>>(),
    db.prepare("SELECT 1 FROM packs WHERE status='published' LIMIT 1").first(),
    db.prepare(`SELECT 1 FROM (
      SELECT opened_at AS happened_at FROM pack_openings WHERE user_email=?
      UNION ALL SELECT claimed_at AS happened_at FROM pack_claims WHERE user_email=?
    ) WHERE happened_at>=? LIMIT 1`).bind(email, email, start).first(),
    db.prepare("SELECT reward_key FROM mission_reward_claims WHERE user_email=? AND period_key IN (?,?)").bind(email, today, weekStartKey()).all<{ reward_key: RewardKey }>(),
    db.prepare(`SELECT period_key FROM mission_reward_claims
      WHERE user_email=? AND reward_key='daily_complete' AND period_key>=? AND period_key<=?`)
      .bind(email, weekStartKey(), today).all<{ period_key: string }>(),
    db.prepare("SELECT points FROM users WHERE email=?").bind(email).first<{ points: number }>(),
  ]);

  const claimed = new Set((claimRows.results ?? []).map((row) => row.reward_key));
  const hasActivePack = Boolean(activePack);
  const progress = {
    login: Math.min(1, Number(eventCounts?.loginCount ?? 0)),
    card_views: Math.min(3, Number(eventCounts?.cardViews ?? 0)),
    pack_activity: Math.min(1, hasActivePack ? Number(Boolean(opening)) : Number(eventCounts?.pastPackViews ?? 0)),
  };
  const baseComplete = progress.login >= 1 && progress.card_views >= 3 && progress.pack_activity >= 1;
  const weeklyProgress = new Set((weeklyRows.results ?? []).map((row) => row.period_key)).size;
  const mission = (key: DailyRewardKey, title: string, current: number, target: number) => ({
    key, title, current, target, reward: REWARDS[key], complete: current >= target,
    claimed: claimed.has(key), available: current >= target && !claimed.has(key),
  });

  return {
    date: today,
    missions: [
      mission("login", "今日ログインする", progress.login, 1),
      mission("card_views", "違うカードを3枚見る", progress.card_views, 3),
      mission("pack_activity", hasActivePack ? "パックを1回開封する" : "過去パックを1つ見る", progress.pack_activity, 1),
    ],
    dailyBonus: { key: "daily_complete", title: "デイリー全達成", current: [progress.login >= 1, progress.card_views >= 3, progress.pack_activity >= 1].filter(Boolean).length, target: 3, reward: REWARDS.daily_complete, complete: baseComplete, claimed: claimed.has("daily_complete"), available: baseComplete && !claimed.has("daily_complete") },
    weekly: { key: "weekly_bonus", title: "週間チャレンジ", current: Math.min(5, weeklyProgress), target: 5, reward: REWARDS.weekly_bonus, complete: weeklyProgress >= 5, claimed: claimed.has("weekly_bonus"), available: weeklyProgress >= 5 && !claimed.has("weekly_bonus"), periodKey: weekStartKey() },
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
  const db = getRawDb();
  const body = await request.json().catch(() => ({})) as { action?: string; eventType?: string; referenceId?: string; rewardKey?: RewardKey };

  if (body.action === "event") {
    if (!body.referenceId || !["card_view", "past_pack_view"].includes(body.eventType ?? ""))
      return Response.json({ error: "操作を記録できませんでした" }, { status: 400 });
    const exists = body.eventType === "card_view"
      ? await db.prepare("SELECT 1 FROM cards WHERE id=? LIMIT 1").bind(body.referenceId).first()
      : await db.prepare("SELECT 1 FROM packs WHERE id=? AND status='archived' LIMIT 1").bind(body.referenceId).first();
    if (!exists) return Response.json({ error: "対象が見つかりません" }, { status: 404 });
    await db.prepare(`INSERT OR IGNORE INTO daily_mission_events
      (user_email,event_date,event_type,reference_id,created_at) VALUES (?,?,?,?,?)`)
      .bind(member.email, dateKey(), body.eventType, body.referenceId, Date.now()).run();
    return Response.json({ ok: true });
  }

  if (body.action !== "claim" || !body.rewardKey || !(body.rewardKey in REWARDS))
    return Response.json({ error: "受け取る報酬を選んでください" }, { status: 400 });
  const state = await getState(member.email);
  const reward = [...state.missions, state.dailyBonus, state.weekly].find((item) => item.key === body.rewardKey);
  if (!reward?.complete) return Response.json({ error: "まだミッションを達成していません" }, { status: 400 });
  if (reward.claimed) return Response.json({ error: "この報酬は受取済みです" }, { status: 409 });
  const periodKey = body.rewardKey === "weekly_bonus" ? state.weekly.periodKey : state.date;
  const inserted = await db.prepare(`INSERT OR IGNORE INTO mission_reward_claims
    (user_email,period_key,reward_key,claimed_at) VALUES (?,?,?,?) RETURNING reward_key`)
    .bind(member.email, periodKey, body.rewardKey, Date.now()).first();
  if (!inserted) return Response.json({ error: "この報酬は受取済みです" }, { status: 409 });
  await db.prepare("UPDATE users SET points=points+? WHERE email=?").bind(REWARDS[body.rewardKey], member.email).run();
  return Response.json({ ok: true, reward: REWARDS[body.rewardKey] });
}
