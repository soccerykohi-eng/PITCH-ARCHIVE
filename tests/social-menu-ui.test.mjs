import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const social=await readFile(new URL("../app/social-panel.tsx",import.meta.url),"utf8");
const archive=await readFile(new URL("../app/archive-app.tsx",import.meta.url),"utf8");
const styles=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
const safety=await readFile(new URL("../app/components/safety-settings.tsx",import.meta.url),"utf8");
const notifications=await readFile(new URL("../app/components/notifications-page-client.tsx",import.meta.url),"utf8");

test("social uses native segment and friend profile subpages",()=>{
  assert.match(social,/SocialHome/);assert.match(social,/FriendDetail/);assert.match(social,/native-friend-row/);assert.match(social,/native-subpage friend-profile/);
  assert.doesNotMatch(social,/className="friend-card"/);
});

test("trade creation has three user-facing steps",()=>{
  assert.match(social,/STEP \{step\} \/ 3/);assert.match(social,/あなたが渡すカードを選ぶ/);assert.match(social,/受け取りたいカードを選ぶ/);assert.match(social,/トレード確認/);
  assert.match(social,/あなたが渡す/);assert.match(social,/あなたが受け取る/);
});

test("showcase and safety settings use native flows",()=>{
  assert.match(social,/ShowcaseEditor/);assert.match(social,/ショーケース編集/);assert.match(safety,/プライバシー・安全/);assert.doesNotMatch(archive,/SafetySettings/);
});

test("mobile subpages hide bottom navigation and respect safe area",()=>{
  assert.match(styles,/has-native-subpage \.network-nav\{display:none/);assert.match(styles,/height:100dvh/);assert.match(styles,/safe-area-inset-bottom/);
});

test("notifications route directly to request or trade tabs",()=>{
  assert.match(notifications,/item\.type==="trade"\?"\/friends\/trades":"\/friends\/requests"/);assert.match(archive,/initialView=\{socialInitialView\}/);
});
