import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("keeps account reporting removed while preserving report history", async () => {
  const [social, admin, schema] = await Promise.all([
    readFile(new URL("app/social-panel.tsx", root), "utf8"),
    readFile(new URL("app/admin-operations.tsx", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
  ]);

  assert.doesNotMatch(social, /reportReason|reportDetails|運営へ通報|通報理由/);
  assert.doesNotMatch(admin, /\/api\/admin\/moderation|resolveReport|value="reports"/);
  assert.match(admin, /操作履歴を確認します。/);
  await assert.rejects(access(new URL("app/api/admin/moderation/route.ts", root)));
  assert.match(schema, /reports/);
});
