import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("removes announcements and Web Push while preserving in-app notifications", async () => {
  const [app, admin, notifications, social, schedule, publish, packageJson, schema] = await Promise.all([
    readFile(new URL("app/archive-app.tsx", root), "utf8"),
    readFile(new URL("app/admin-operations.tsx", root), "utf8"),
    readFile(new URL("app/api/notifications/route.ts", root), "utf8"),
    readFile(new URL("app/api/social/route.ts", root), "utf8"),
    readFile(new URL("app/pack-schedule.ts", root), "utf8"),
    readFile(new URL("app/api/admin/packs/[id]/publish/route.ts", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
  ]);

  for (const removed of ["pushStatus", "serviceWorker", "PushManager", "Notification.requestPermission", "/api/push-subscription", "端末通知を受け取る"]) {
    assert.doesNotMatch(app, new RegExp(removed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(admin, /お知らせ|\/api\/admin\/announcements/);
  assert.match(admin, /操作履歴を確認します。/);
  assert.match(notifications, /type<>'announcement'/);
  assert.doesNotMatch(notifications, /FROM announcements|announcement_recipients/);

  for (const source of [social, schedule, publish]) {
    assert.match(source, /INSERT INTO notifications|notification\(db/);
    assert.doesNotMatch(source, /sendPush|@\/app\/push/);
  }
  assert.doesNotMatch(packageJson, /web-push/);
  assert.match(schema, /pushSubscriptions/);
  assert.match(schema, /announcements/);
  assert.match(schema, /announcementRecipients/);

  for (const path of [
    "app/api/admin/announcements/route.ts",
    "app/api/push-subscription/route.ts",
    "app/push.ts",
    "public/push-sw.js",
  ]) await assert.rejects(access(new URL(path, root)));
});
