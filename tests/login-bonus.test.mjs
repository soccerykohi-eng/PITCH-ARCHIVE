import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { calculateLoginBonus, loginBonusDateKey } from "../app/login-bonus.ts";

const root = new URL("..", import.meta.url);

test("replaces mission tracking with one daily JST login bonus", async () => {
  const [route, app, schema] = await Promise.all([
    readFile(new URL("app/api/login-bonus/route.ts", root), "utf8"),
    readFile(new URL("app/archive-app.tsx", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
  ]);

  assert.match(route, /calculateLoginBonus/);
  assert.match(route, /loginBonusDateKey/);
  assert.match(route, /reward_key='login'/);
  assert.match(route, /INSERT OR IGNORE INTO mission_reward_claims/);
  assert.match(route, /body\.action !== "claim"/);
  assert.doesNotMatch(route, /card_view|past_pack_view|weekly_bonus|daily_complete/);

  assert.match(app, /DAILY BONUS/);
  assert.match(app, /ログインボーナス/);
  assert.match(app, /fetch\("\/api\/login-bonus"/);
  for (const removed of [
    "/api/daily-mission",
    "今日のチャレンジ",
    "週間チャレンジ",
    "全達成ボーナス",
    "card_view",
    "past_pack_view",
  ]) assert.doesNotMatch(app, new RegExp(removed));

  await assert.rejects(access(new URL("app/api/daily-mission/route.ts", root)));
  assert.match(schema, /dailyMissionEvents/);
  assert.match(schema, /missionRewardClaims/);
});

test("calculates Wednesday and seven-day rewards in JST", async () => {
  assert.equal(loginBonusDateKey(Date.parse("2026-09-08T14:59:59Z")), "2026-09-08");
  assert.equal(loginBonusDateKey(Date.parse("2026-09-08T15:00:00Z")), "2026-09-09");

  const wednesday = calculateLoginBonus("2026-09-09", ["2026-09-08"]);
  assert.equal(wednesday.reward, 50);
  assert.equal(wednesday.streakDay, 2);

  const sixDays = ["2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08"];
  const seventhWednesday = calculateLoginBonus("2026-09-09", sixDays);
  assert.equal(seventhWednesday.streakDay, 7);
  assert.equal(seventhWednesday.reward, 100);

  const newCycle = calculateLoginBonus("2026-09-10", [...sixDays, "2026-09-09"]);
  assert.equal(newCycle.streak, 0);
  assert.equal(newCycle.streakDay, 1);
  assert.equal(newCycle.reward, 30);
});

test("resets after a missed day and prevents a second same-day claim", async () => {
  const reset = calculateLoginBonus("2026-09-09", ["2026-09-07"]);
  assert.equal(reset.streak, 0);
  assert.equal(reset.streakDay, 1);

  const claimed = calculateLoginBonus("2026-09-09", ["2026-09-08", "2026-09-09"]);
  assert.equal(claimed.claimed, true);
  assert.equal(claimed.available, false);
  assert.equal(claimed.streakDay, 2);
});
