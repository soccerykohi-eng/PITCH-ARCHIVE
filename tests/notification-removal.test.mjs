import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("removes notification UI, API, polling, and event writes", async () => {
  const [app, provider, nav, social, schedule, publish, users, schema] = await Promise.all([
    readFile(new URL("app/archive-app.tsx", root), "utf8"),
    readFile(new URL("app/components/app/app-data-provider.tsx", root), "utf8"),
    readFile(new URL("app/components/app/bottom-navigation.tsx", root), "utf8"),
    readFile(new URL("app/api/social/route.ts", root), "utf8"),
    readFile(new URL("app/pack-schedule.ts", root), "utf8"),
    readFile(new URL("app/api/admin/packs/[id]/publish/route.ts", root), "utf8"),
    readFile(new URL("app/api/admin/users/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
  ]);

  for (const source of [app, provider, nav, social, schedule, publish, users]) {
    assert.doesNotMatch(source, /\/notifications|INSERT INTO notifications|unreadCount|notificationMessage|公開通知/);
  }
  for (const path of [
    "app/api/notifications/route.ts",
    "app/components/notifications-page-client.tsx",
    "app/(player)/notifications/page.tsx",
  ]) await assert.rejects(access(new URL(path, root)));

  assert.match(schema, /export const notifications/);
});
