import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("removes player blocking while preserving the legacy database table", async () => {
  const [social, socialApi, archive, settings, schema] = await Promise.all([
    readFile(new URL("app/social-panel.tsx", root), "utf8"),
    readFile(new URL("app/api/social/route.ts", root), "utf8"),
    readFile(new URL("app/archive-app.tsx", root), "utf8"),
    readFile(new URL("app/components/settings-page-client.tsx", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
  ]);

  for (const source of [social, socialApi, archive, settings]) {
    assert.doesNotMatch(source, /\/api\/safety|safetyAction|ブロック中|参加者をブロック|\/settings\/safety/);
  }
  assert.doesNotMatch(socialApi, /FROM blocks/);
  await assert.rejects(access(new URL("app/api/safety/route.ts", root)));
  await assert.rejects(access(new URL("app/(player)/settings/safety/page.tsx", root)));
  await assert.rejects(access(new URL("app/components/safety-settings.tsx", root)));
  assert.match(schema, /sqliteTable\("blocks"/);
});
