import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [app,css]=await Promise.all([
  readFile(new URL("../app/archive-app.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
]);

test("keeps primary mobile menu actions before the profile card",() => {
  const today=app.indexOf('<p className="menu-section-label">TODAY</p>');
  const bonus=app.indexOf("<DailyBonus",today);
  const settings=app.indexOf('<strong>アカウント設定</strong>',bonus);
  const profile=app.indexOf('<div className="menu-profile">',settings);
  assert.ok(today>=0 && bonus>today && settings>bonus && profile>settings);
  assert.doesNotMatch(app,/\/notifications|<Bell|unreadCount|\/exchange|カード交換所/);
  assert.match(css,/\.menu-page>\.root-page-title\{margin-bottom:4px\}/);
});
