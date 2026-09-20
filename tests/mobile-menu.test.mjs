import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [app,css]=await Promise.all([
  readFile(new URL("../app/archive-app.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
]);

test("keeps primary mobile menu actions before the profile card",() => {
  const today=app.indexOf('<p className="menu-section-label">TODAY</p>');
  const exchange=app.indexOf("<DailyAndExchange",today);
  const notifications=app.indexOf('window.location.assign("/notifications")',exchange);
  const settings=app.indexOf('<strong>アカウント設定</strong>',notifications);
  const profile=app.indexOf('<div className="menu-profile">',settings);
  assert.ok(today>=0 && exchange>today && notifications>exchange && settings>notifications && profile>settings);
  assert.match(css,/\.menu-page>\.root-page-title\{margin-bottom:4px\}/);
});
