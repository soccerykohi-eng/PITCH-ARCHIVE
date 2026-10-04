import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const social=await readFile(new URL("../app/social-panel.tsx",import.meta.url),"utf8");
const socialApi=await readFile(new URL("../app/api/social/route.ts",import.meta.url),"utf8");
const archive=await readFile(new URL("../app/archive-app.tsx",import.meta.url),"utf8");
const styles=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");

test("social uses native segment and friend profile subpages",()=>{
  assert.match(social,/SocialHome/);assert.match(social,/FriendDetail/);assert.match(social,/native-friend-row/);assert.match(social,/native-subpage friend-profile/);
  assert.doesNotMatch(social,/className="friend-card"/);
});

test("friend home uses a game-style segmented roster",()=>{
  assert.match(social,/フレンド数: \{data\.friends\.length\}/);
  assert.match(social,/data\.friends\.map/);
  assert.doesNotMatch(social,/data\.friends\.slice\(0,3\)/);
  assert.match(styles,/\.social-subnav\{[^}]*border-radius:999px/);
  assert.match(styles,/\.native-friend-row\{[^}]*min-height:92px/);
  assert.match(styles,/\.native-friend-row \.person-avatar\{width:62px;height:62px/);
});

test("trade creation has three user-facing steps",()=>{
  assert.match(social,/STEP \{step\} \/ 3/);assert.match(social,/あなたが渡すカードを選ぶ/);assert.match(social,/受け取りたいカードを選ぶ/);assert.match(social,/トレード確認/);
  assert.match(social,/あなたが渡す/);assert.match(social,/あなたが受け取る/);
});

test("showcase and player blocking are removed",async()=>{
  assert.doesNotMatch(social,/ShowcaseEditor|ショーケース|showcase\.save|ownShowcase|ブロック|safetyAction|\/api\/safety/);assert.doesNotMatch(socialApi,/showcaseFor|showcase\.save|ownShowcase|FROM blocks/);assert.doesNotMatch(archive,/SafetySettings|\/settings\/safety|プライバシー・安全/);
  await assert.rejects(access(new URL("../app/api/safety/route.ts",import.meta.url)));
});

test("mobile subpages hide bottom navigation and respect safe area",()=>{
  assert.match(styles,/has-native-subpage \.network-nav\{display:none/);assert.match(styles,/height:100dvh/);assert.match(styles,/safe-area-inset-bottom/);
});

test("friend and trade tabs remain directly routable",()=>{
  assert.match(archive,/key=\{socialRouteView\}/);
  assert.match(archive,/initialView=\{socialRouteView\}/);
});
