import { readFileSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(import.meta.dirname,"..");
const source=JSON.parse(readFileSync(resolve(root,"backup/production-content.json"),"utf8"));
const expected={
  cards:["id","name","position","country","team","number","rating","rarity","series","card_type","season","image_key","created_at"],
  packs:["id","name","description","status","created_at","point_cost","publish_at","end_at","open_limit","notification_message"],
  pack_cards:["pack_id","card_id","sort_order"],
  announcements:["id","title","message","audience","publish_at","created_by","created_at","updated_at"],
};

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replaceAll("'","''")}'`;
}

const lines=["PRAGMA foreign_keys = ON;",
  `INSERT OR IGNORE INTO users (email,display_name,role,status,created_at) VALUES ('admin@pitcharchive.local','PITCH ARCHIVE Admin','admin','approved',${Date.now()});`];

for (const [table,columns] of Object.entries(expected)) {
  const data=source.tables?.[table];
  if (!data || JSON.stringify(data.columns) !== JSON.stringify(columns)) throw new Error(`${table} のバックアップ形式が一致しません`);
  for (const original of data.rows) {
    const row={ ...original };
    if (table === "announcements") row.created_by="admin@pitcharchive.local";
    const values=columns.map((column) => sql(row[column])).join(",");
    const updates=columns.filter((column) => !["id","pack_id","card_id"].includes(column)).map((column) => `${column}=excluded.${column}`).join(",");
    const conflict=table === "pack_cards" ? "pack_id,card_id" : "id";
    lines.push(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${values}) ON CONFLICT(${conflict}) DO UPDATE SET ${updates};`);
  }
}

writeFileSync(resolve(root,".production-import.sql"),`${lines.join("\n")}\n`,{ mode:0o600 });
console.log(`Prepared ${expected.cards.length ? source.tables.cards.rows.length : 0} cards, ${source.tables.packs.rows.length} packs, ${source.tables.pack_cards.rows.length} pack links, and ${source.tables.announcements.rows.length} announcements.`);
