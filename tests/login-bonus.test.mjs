import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("replaces mission tracking with one daily JST login bonus", async () => {
  const [route, app, schema] = await Promise.all([
    readFile(new URL("app/api/login-bonus/route.ts", root), "utf8"),
    readFile(new URL("app/archive-app.tsx", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
  ]);

  assert.match(route, /const LOGIN_BONUS = 30/);
  assert.match(route, /const JST_OFFSET = 9 \* 60 \* 60 \* 1000/);
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
