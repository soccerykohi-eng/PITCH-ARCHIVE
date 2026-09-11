import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root=resolve(import.meta.dirname,"..");
const backup=JSON.parse(readFileSync(resolve(root,"backup/production-content.json"),"utf8"));
const required=backup.tables.cards.rows.filter((card) => !card.image_key.startsWith("/"));
const assets=new Map();

for (const directory of process.argv.slice(2)) {
  const manifest=JSON.parse(readFileSync(resolve(directory,"manifest.json"),"utf8"));
  for (const asset of manifest.assets ?? []) {
    const marker="/api/card-image/";
    const index=asset.url.indexOf(marker);
    if (index >= 0) assets.set(decodeURIComponent(asset.url.slice(index+marker.length).split("?")[0]),asset);
  }
}

const missing=required.filter((card) => !assets.has(card.id));
if (missing.length) throw new Error(`不足画像: ${missing.map((card) => card.id).join(", ")}`);

for (const [index,card] of required.entries()) {
  const asset=assets.get(card.id);
  const result=spawnSync("npx",["wrangler","kv","key","put",card.image_key,"--binding","CARD_IMAGES","--path",asset.path,"--metadata",JSON.stringify({ contentType:asset.contentType ?? "image/webp" }),"--remote","--config","wrangler.jsonc"],{
    cwd:root,env:{ ...process.env,WRANGLER_WRITE_LOGS:"false" },stdio:"inherit"
  });
  if (result.status !== 0) throw new Error(`${card.id} のKV保存に失敗しました`);
  console.log(`[${index+1}/${required.length}] ${card.id}`);
}

console.log(`Uploaded ${required.length} legacy card images to CARD_IMAGES.`);
