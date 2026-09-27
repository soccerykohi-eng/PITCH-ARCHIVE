import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("removes the card exchange shop while preserving legacy data cleanup", async () => {
  const [app, styles, purge, schema] = await Promise.all([
    readFile(new URL("app/archive-app.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/api/admin/cards/purge/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
  ]);
  assert.doesNotMatch(app, /\/exchange|カード交換所|exchange-entry|DailyAndExchange/);
  assert.doesNotMatch(styles, /exchange-entry|exchange-grid|exchange-dialog|route-exchange-grid/);
  await assert.rejects(access(new URL("app/(player)/exchange/page.tsx", root)));
  await assert.rejects(access(new URL("app/api/exchange/route.ts", root)));
  await assert.rejects(access(new URL("app/components/exchange-page-client.tsx", root)));
  assert.match(schema, /dailyExchangeOffers/);
  assert.match(purge, /DELETE FROM daily_exchange_offers/);
});
