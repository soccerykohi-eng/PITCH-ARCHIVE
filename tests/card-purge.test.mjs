import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const [migration,purge,normalCards,ui]=await Promise.all([
  readFile(new URL("../drizzle/0019_common_the_hood.sql",import.meta.url),"utf8"),
  readFile(new URL("../app/api/admin/cards/purge/route.ts",import.meta.url),"utf8"),
  readFile(new URL("../app/api/admin/cards/route.ts",import.meta.url),"utf8"),
  readFile(new URL("../app/admin-card-library.tsx",import.meta.url),"utf8"),
]);

test("migration preserves every opening and legacy claim while making card references nullable", () => {
  const db=new DatabaseSync(":memory:");
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(email TEXT PRIMARY KEY);
    CREATE TABLE packs(id TEXT PRIMARY KEY);
    CREATE TABLE cards(id TEXT PRIMARY KEY);
    CREATE TABLE pack_claims(user_email TEXT NOT NULL,pack_id TEXT NOT NULL,card_id TEXT NOT NULL,claimed_at INTEGER NOT NULL,PRIMARY KEY(user_email,pack_id),FOREIGN KEY(user_email) REFERENCES users(email) ON DELETE CASCADE,FOREIGN KEY(pack_id) REFERENCES packs(id) ON DELETE CASCADE,FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE);
    CREATE TABLE pack_openings(id TEXT PRIMARY KEY,user_email TEXT NOT NULL,pack_id TEXT NOT NULL,card_id TEXT NOT NULL,opened_at INTEGER NOT NULL,FOREIGN KEY(user_email) REFERENCES users(email) ON DELETE CASCADE,FOREIGN KEY(pack_id) REFERENCES packs(id) ON DELETE CASCADE,FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE);
    CREATE INDEX idx_pack_openings_user_pack ON pack_openings(user_email,pack_id);
    INSERT INTO users VALUES ('a'),('b');INSERT INTO packs VALUES ('archived-a'),('archived-b');INSERT INTO cards VALUES ('legacy'),('other');
    INSERT INTO pack_openings VALUES ('opening-a','a','archived-a','legacy',1),('opening-b','b','archived-b','other',2);
    INSERT INTO pack_claims VALUES ('b','archived-a','legacy',1);`);
  const before={ openings:db.prepare("SELECT COUNT(*) count FROM pack_openings").get().count,claims:db.prepare("SELECT COUNT(*) count FROM pack_claims").get().count };
  for (const statement of migration.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) db.exec(statement);
  assert.deepEqual({ openings:db.prepare("SELECT COUNT(*) count FROM pack_openings").get().count,claims:db.prepare("SELECT COUNT(*) count FROM pack_claims").get().count },before);
  db.exec("DELETE FROM cards WHERE id='legacy'");
  assert.equal(db.prepare("SELECT card_id cardId FROM pack_openings WHERE id='opening-a'").get().cardId,null);
  assert.equal(db.prepare("SELECT card_id cardId FROM pack_claims WHERE user_email='b'").get().cardId,null);
  assert.equal(db.prepare("SELECT COUNT(*) total FROM pack_openings WHERE user_email='a' AND pack_id='archived-a'").get().total,1);
  assert.equal(db.prepare("SELECT card_id cardId FROM pack_openings WHERE id='opening-b'").get().cardId,"other");
  db.close();
});

test("purge is admin-only, previews impact, protects active packs, and removes only card data", () => {
  assert.match(purge,/requireAdmin\(\)/);
  assert.match(purge,/confirmName !== card\.name/);
  assert.match(purge,/p\.status IN \('scheduled','published'\)/);
  assert.match(purge,/status:409/);
  for (const table of ["collection","card_showcase","pack_cards","trades","daily_exchange_offers","notifications","cards"]) assert.match(purge,new RegExp(`DELETE FROM ${table}`));
  assert.match(purge,/UPDATE pack_openings SET card_id=NULL/);
  assert.match(purge,/UPDATE pack_claims SET card_id=NULL/);
  assert.match(purge,/"card\.purge"/);
  assert.match(purge,/getImageStore\(\)\.delete/);
  assert.match(normalCards,/パックまたはコレクションで使用中のカードは削除できません/);
});

test("admin UI requires exact typed confirmation and disables duplicate submission", () => {
  assert.match(ui,/>完全削除<\/Button>/);
  assert.match(ui,/確認のためカード名を入力してください/);
  assert.match(ui,/purgeConfirm !== purgeCard\?\.name/);
  assert.match(ui,/disabled=\{busy \|\| !purgeImpact/);
  assert.match(ui,/過去のパック開封回数は維持されます/);
});
