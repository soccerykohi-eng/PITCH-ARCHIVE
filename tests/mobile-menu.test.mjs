import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [app,css]=await Promise.all([
  readFile(new URL("../app/archive-app.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
]);

test("orders the mobile menu like a native account hub",() => {
  const profile=app.indexOf('className="menu-profile"');
  const today=app.indexOf('<p className="menu-section-label">今日</p>',profile);
  const bonus=app.indexOf("<DailyBonus",today);
  const account=app.indexOf('<p className="menu-section-label">アカウント</p>',bonus);
  const settings=app.indexOf('<strong>アカウント設定</strong>',account);
  const other=app.indexOf('<p className="menu-section-label">その他</p>',settings);
  assert.ok(profile>=0 && today>profile && bonus>today && account>bonus && settings>account && other>settings);
  assert.doesNotMatch(app,/\/notifications|<Bell|unreadCount|\/exchange|カード交換所/);
  assert.match(css,/\.menu-page>\.root-page-title\{margin-bottom:4px\}/);
  assert.match(css,/\.menu-page>\.menu-profile\{width:100%;grid-template-columns:68px/);
});
