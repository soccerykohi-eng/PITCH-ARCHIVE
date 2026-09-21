import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const [preview,purge,helper,dashboard,dashboardData,ui]=await Promise.all([
  readFile(new URL("../app/api/admin/users/purge-preview/route.ts",import.meta.url),"utf8"),
  readFile(new URL("../app/api/admin/users/purge/route.ts",import.meta.url),"utf8"),
  readFile(new URL("../app/admin-user-purge.ts",import.meta.url),"utf8"),
  readFile(new URL("../app/api/dashboard/route.ts",import.meta.url),"utf8"),
  readFile(new URL("../app/server-dashboard.ts",import.meta.url),"utf8"),
  readFile(new URL("../app/archive-app.tsx",import.meta.url),"utf8"),
]);

test("preview and purge enforce admin, 1-50 targets, player protection, Google recheck, and exact confirmation",() => {
  for (const source of [preview,purge]) {
    assert.match(source,/requireAdmin\(\)/);
    assert.match(source,/emails\.length > MAX_PURGE_USERS/);
    assert.match(source,/target\.role !== "player"/);
    assert.match(source,/ADMIN_EMAIL/);
  }
  assert.match(helper,/MAX_PURGE_USERS=50/);
  assert.match(helper,/new Set/);
  assert.match(purge,/`DELETE \$\{emails\.length\} ACCOUNTS`/);
  assert.match(purge,/targets\.some\(\(target:PurgeTarget\) => target\.googleLinked\)/);
  assert.match(purge,/status:409/);
});

test("purge handles legacy announcement FK, removes user-scoped audit history, logs one aggregate, and deletes avatars after DB batch",() => {
  assert.match(purge,/DELETE FROM announcements WHERE created_by/);
  assert.match(purge,/DELETE FROM audit_logs WHERE actor_email/);
  assert.match(purge,/target_type='user'/);
  assert.match(purge,/"user\.bulk_purge"/);
  assert.doesNotMatch(purge,/emails.*JSON\.stringify/);
  assert.match(purge,/await db\.batch/);
  assert.match(purge,/getImageStore\(\)\.delete\(`avatars\/\$\{target\.avatarKey\}`\)/);
});

test("admin list exposes Google state, cleanup candidates, current-filter selection, preview, and typed confirmation",() => {
  assert.match(dashboard,/getDashboardData/);
  assert.match(dashboardData,/LEFT JOIN google_identities/);
  assert.match(dashboardData,/packOpeningCount/);
  assert.match(ui,/Google 連携済み/);
  assert.match(ui,/Google 未連携/);
  assert.match(ui,/整理候補/);
  assert.match(ui,/表示中を全選択/);
  assert.match(ui,/\/api\/admin\/users\/purge-preview/);
  assert.match(ui,/\/api\/admin\/users\/purge/);
  assert.match(ui,/DELETE \$\{purgePreview\.userCount\} ACCOUNTS/);
  assert.match(ui,/disabled=\{Boolean\(user\.googleLinked\)\}/);
});

test("local cleanup fixtures classify only an unlinked empty player as a candidate",() => {
  const db=new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE users(email TEXT PRIMARY KEY,role TEXT NOT NULL);
    CREATE TABLE google_identities(user_email TEXT);CREATE TABLE collection(user_email TEXT);CREATE TABLE pack_openings(user_email TEXT);
    CREATE TABLE friendships(user_a_email TEXT,user_b_email TEXT);CREATE TABLE trades(proposer_email TEXT,recipient_email TEXT);
    INSERT INTO users VALUES ('a','player'),('b','player'),('c','player'),('d','player'),('e','admin');
    INSERT INTO google_identities VALUES ('b');INSERT INTO collection VALUES ('c');INSERT INTO pack_openings VALUES ('d');`);
  const candidates=db.prepare(`SELECT u.email FROM users u WHERE u.role='player'
    AND NOT EXISTS(SELECT 1 FROM google_identities g WHERE g.user_email=u.email)
    AND NOT EXISTS(SELECT 1 FROM collection c WHERE c.user_email=u.email)
    AND NOT EXISTS(SELECT 1 FROM pack_openings p WHERE p.user_email=u.email)
    AND NOT EXISTS(SELECT 1 FROM friendships f WHERE f.user_a_email=u.email OR f.user_b_email=u.email)
    AND NOT EXISTS(SELECT 1 FROM trades t WHERE t.proposer_email=u.email OR t.recipient_email=u.email) ORDER BY u.email`).all().map((row) => row.email);
  assert.deepEqual(candidates,["a"]);
  db.close();
});

test("user deletion cascades private data, handles legacy announcements, and preserves shared and other-user data",() => {
  const db=new DatabaseSync(":memory:");
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(email TEXT PRIMARY KEY,role TEXT NOT NULL);
    CREATE TABLE cards(id TEXT PRIMARY KEY);CREATE TABLE packs(id TEXT PRIMARY KEY);
    CREATE TABLE collection(user_email TEXT,card_id TEXT,quantity INTEGER,FOREIGN KEY(user_email) REFERENCES users(email) ON DELETE CASCADE,FOREIGN KEY(card_id) REFERENCES cards(id));
    CREATE TABLE pack_openings(id TEXT,user_email TEXT,pack_id TEXT,FOREIGN KEY(user_email) REFERENCES users(email) ON DELETE CASCADE,FOREIGN KEY(pack_id) REFERENCES packs(id));
    CREATE TABLE friendships(user_a_email TEXT,user_b_email TEXT,FOREIGN KEY(user_a_email) REFERENCES users(email) ON DELETE CASCADE,FOREIGN KEY(user_b_email) REFERENCES users(email) ON DELETE CASCADE);
    CREATE TABLE trades(id TEXT,proposer_email TEXT,recipient_email TEXT,FOREIGN KEY(proposer_email) REFERENCES users(email) ON DELETE CASCADE,FOREIGN KEY(recipient_email) REFERENCES users(email) ON DELETE CASCADE);
    CREATE TABLE notifications(id TEXT,user_email TEXT,FOREIGN KEY(user_email) REFERENCES users(email) ON DELETE CASCADE);
    CREATE TABLE mission_reward_claims(user_email TEXT,period_key TEXT,FOREIGN KEY(user_email) REFERENCES users(email) ON DELETE CASCADE);
    CREATE TABLE google_identities(google_sub TEXT,user_email TEXT,FOREIGN KEY(user_email) REFERENCES users(email) ON DELETE CASCADE);
    CREATE TABLE passkey_credentials(credential_id TEXT,user_email TEXT,FOREIGN KEY(user_email) REFERENCES users(email) ON DELETE CASCADE);
    CREATE TABLE announcements(id TEXT PRIMARY KEY,created_by TEXT NOT NULL,FOREIGN KEY(created_by) REFERENCES users(email));
    CREATE TABLE announcement_recipients(announcement_id TEXT,user_email TEXT,FOREIGN KEY(announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,FOREIGN KEY(user_email) REFERENCES users(email) ON DELETE CASCADE);
    INSERT INTO users VALUES ('remove','player'),('keep','player'),('admin@pitcharchive.local','admin');
    INSERT INTO cards VALUES ('shared');INSERT INTO packs VALUES ('shared-pack');
    INSERT INTO collection VALUES ('remove','shared',2),('keep','shared',1);
    INSERT INTO pack_openings VALUES ('o1','remove','shared-pack'),('o2','keep','shared-pack');
    INSERT INTO friendships VALUES ('remove','keep');INSERT INTO trades VALUES ('t1','remove','keep');
    INSERT INTO notifications VALUES ('n1','remove');INSERT INTO mission_reward_claims VALUES ('remove','2026-09-19');
    INSERT INTO google_identities VALUES ('sub','remove');INSERT INTO passkey_credentials VALUES ('cred','remove');
    INSERT INTO announcements VALUES ('legacy','remove');INSERT INTO announcement_recipients VALUES ('legacy','keep');
    DELETE FROM announcements WHERE created_by='remove';DELETE FROM users WHERE email='remove' AND role='player';`);
  for (const table of ["friendships","trades","notifications","mission_reward_claims","google_identities","passkey_credentials","announcements","announcement_recipients"]) assert.equal(db.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count,0);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM collection WHERE user_email='keep'").get().count,1);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM pack_openings WHERE user_email='keep'").get().count,1);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM cards").get().count,1);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM packs").get().count,1);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM users WHERE email='admin@pitcharchive.local'").get().count,1);
  db.close();
});
