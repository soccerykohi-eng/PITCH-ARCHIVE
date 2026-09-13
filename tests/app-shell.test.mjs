import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const app = await readFile(new URL("../app/archive-app.tsx", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const manifest = JSON.parse(
  await readFile(new URL("../public/site.webmanifest", import.meta.url), "utf8"),
);

test("defines the Archive Black design system tokens", () => {
  for (const token of [
    "--pa-bg",
    "--pa-surface-1",
    "--pa-surface-2",
    "--pa-surface-3",
    "--pa-surface-active",
    "--pa-text-1",
    "--pa-text-2",
    "--pa-text-3",
    "--pa-accent",
    "--pa-border",
    "--pa-danger",
    "--pa-motion-fast",
    "--pa-motion-normal",
    "--pa-motion-page",
  ]) {
    assert.match(css, new RegExp(`${token}:`));
  }
  assert.match(css, /--lime:var\(--pa-accent\)/);
});

test("uses the mobile app shell at supported phone widths", () => {
  for (const width of [375, 393, 430]) assert.ok(width < 768);
  for (const width of [768, 1024, 1440]) assert.ok(width >= 768);
  assert.match(css, /@media \(max-width:767px\)/);
  assert.match(css, /\.network-nav \{[\s\S]*?position:fixed;[\s\S]*?inset:auto 0 0;/);
  assert.match(css, /height:calc\(76px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /padding:6px 8px max\(10px,env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /padding:calc\(env\(safe-area-inset-top\) \+ var\(--pa-space-2\)\)/);
  assert.match(css, /padding:0 var\(--pa-space-4\) calc\(96px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.brand-lockup h1 \{ display:block;/);
  assert.match(css, /\.collection-pill,\.account-button \{ display:none!important;/);
  assert.match(css, /\.network-nav button \{ width:100%;height:58px!important;min-height:58px;/);
});

test("keeps the four player tabs, PWA setup, and current admin wording", () => {
  for (const tab of ["packs", "collection", "social", "menu"]) {
    assert.match(app, new RegExp(`<TabsTrigger value="${tab}">`));
  }
  assert.doesNotMatch(app, /参加者・パック・お知らせを管理/);
  assert.match(app, /参加者・パック・操作ログを管理/);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons.length, 2);
  assert.match(layout, /userScalable: false/);
  assert.match(layout, /appleWebApp:/);
});
