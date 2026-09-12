import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("removes account reporting while preserving blocking and report history", async () => {
  const [social, safety, admin, schema] = await Promise.all([
    readFile(new URL("app/social-panel.tsx", root), "utf8"),
    readFile(new URL("app/api/safety/route.ts", root), "utf8"),
    readFile(new URL("app/admin-operations.tsx", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
  ]);

  for (const removed of [
    "reportReason",
    "reportDetails",
    'safetyAction("report"',
    "運営へ通報",
    "通報理由",
  ]) {
    assert.doesNotMatch(social, new RegExp(removed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(social, /safetyAction\(action:"block"\|"unblock"/);
  assert.match(social, /JSON\.stringify\(\{ action,targetEmail \}\)/);

  assert.doesNotMatch(safety, /action === "report"/);
  assert.doesNotMatch(safety, /INSERT INTO reports/);
  assert.doesNotMatch(safety, /user\.report/);
  assert.match(safety, /DELETE FROM friendships/);
  assert.match(safety, /UPDATE trades SET status='cancelled'/);
  assert.match(safety, /action === "block"/);
  assert.match(safety, /action === "unblock"/);

  assert.doesNotMatch(admin, /\/api\/admin\/moderation/);
  assert.doesNotMatch(admin, /resolveReport/);
  assert.doesNotMatch(admin, /value="reports"/);
  assert.match(admin, /操作履歴を確認します。/);

  await assert.rejects(access(new URL("app/api/admin/moderation/route.ts", root)));
  assert.match(schema, /reports/);
});
