import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  email: text("email").primaryKey(),
  friendId: text("friend_id").unique(),
  displayName: text("display_name").notNull(),
  avatarKey: text("avatar_key"),
  role: text("role", { enum:["admin","player"] }).notNull().default("player"),
  status: text("status", { enum:["pending","approved","suspended"] }).notNull().default("pending"),
  points: integer("points").notNull().default(0),
  lastDailyBonus: text("last_daily_bonus").notNull().default(""),
  lastSeenAt: integer("last_seen_at", { mode:"timestamp_ms" }),
  createdAt: integer("created_at", { mode:"timestamp_ms" }).notNull(),
});

export const packs = sqliteTable("packs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status", { enum:["draft","scheduled","published","archived"] }).notNull().default("draft"),
  pointCost: integer("point_cost").notNull().default(100),
  publishAt: integer("publish_at", { mode:"timestamp_ms" }),
  endAt: integer("end_at", { mode:"timestamp_ms" }),
  openLimit: integer("open_limit").notNull().default(1),
  notificationMessage: text("notification_message").notNull().default(""),
  createdAt: integer("created_at", { mode:"timestamp_ms" }).notNull(),
});

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  position: text("position").notNull(),
  country: text("country").notNull(),
  team: text("team").notNull().default(""),
  number: integer("number"),
  rating: integer("rating").notNull(),
  rarity: text("rarity", { enum:["CORE","RARE","ELITE","ICON"] }).notNull(),
  series: text("series").notNull(),
  cardType: text("card_type").notNull(),
  season: text("season").notNull(),
  imageKey: text("image_key").notNull(),
  createdAt: integer("created_at", { mode:"timestamp_ms" }).notNull(),
});

export const packCards = sqliteTable("pack_cards", {
  packId: text("pack_id").notNull().references(() => packs.id, { onDelete:"cascade" }),
  cardId: text("card_id").notNull().references(() => cards.id, { onDelete:"cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [primaryKey({ columns:[table.packId,table.cardId] })]);

export const collection = sqliteTable("collection", {
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete:"cascade" }),
  cardId: text("card_id").notNull().references(() => cards.id, { onDelete:"cascade" }),
  quantity: integer("quantity").notNull().default(1),
  sourcePackId: text("source_pack_id").references(() => packs.id, { onDelete:"set null" }),
  acquiredAt: integer("acquired_at", { mode:"timestamp_ms" }).notNull(),
}, (table) => [primaryKey({ columns:[table.userEmail,table.cardId] })]);

export const cardShowcase = sqliteTable("card_showcase", {
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete:"cascade" }),
  cardId: text("card_id").notNull().references(() => cards.id, { onDelete:"cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [primaryKey({ columns:[table.userEmail,table.cardId] })]);

export const packClaims = sqliteTable("pack_claims", {
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete:"cascade" }),
  packId: text("pack_id").notNull().references(() => packs.id, { onDelete:"cascade" }),
  cardId: text("card_id").notNull().references(() => cards.id, { onDelete:"cascade" }),
  claimedAt: integer("claimed_at", { mode:"timestamp_ms" }).notNull(),
}, (table) => [primaryKey({ columns:[table.userEmail,table.packId] })]);

export const packOpenings = sqliteTable("pack_openings", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete:"cascade" }),
  packId: text("pack_id").notNull().references(() => packs.id, { onDelete:"cascade" }),
  cardId: text("card_id").notNull().references(() => cards.id, { onDelete:"cascade" }),
  openedAt: integer("opened_at", { mode:"timestamp_ms" }).notNull(),
}, (table) => [index("idx_pack_openings_user_pack").on(table.userEmail,table.packId)]);

export const dailyMissionEvents = sqliteTable("daily_mission_events", {
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete:"cascade" }),
  eventDate: text("event_date").notNull(),
  eventType: text("event_type", { enum:["login","card_view","past_pack_view"] }).notNull(),
  referenceId: text("reference_id").notNull(),
  createdAt: integer("created_at", { mode:"timestamp_ms" }).notNull(),
}, (table) => [
  primaryKey({ columns:[table.userEmail,table.eventDate,table.eventType,table.referenceId] }),
  index("idx_daily_mission_events_user_date").on(table.userEmail,table.eventDate),
]);

export const missionRewardClaims = sqliteTable("mission_reward_claims", {
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete:"cascade" }),
  periodKey: text("period_key").notNull(),
  rewardKey: text("reward_key", { enum:["login","card_views","pack_activity","daily_complete","weekly_bonus"] }).notNull(),
  claimedAt: integer("claimed_at", { mode:"timestamp_ms" }).notNull(),
}, (table) => [
  primaryKey({ columns:[table.userEmail,table.periodKey,table.rewardKey] }),
  index("idx_mission_reward_claims_week").on(table.userEmail,table.rewardKey,table.periodKey),
]);

export const friendships = sqliteTable("friendships", {
  userAEmail: text("user_a_email").notNull().references(() => users.email, { onDelete:"cascade" }),
  userBEmail: text("user_b_email").notNull().references(() => users.email, { onDelete:"cascade" }),
  requestedBy: text("requested_by").notNull().references(() => users.email, { onDelete:"cascade" }),
  status: text("status", { enum:["pending","accepted"] }).notNull().default("pending"),
  createdAt: integer("created_at", { mode:"timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode:"timestamp_ms" }).notNull(),
}, (table) => [primaryKey({ columns:[table.userAEmail,table.userBEmail] })]);

export const trades = sqliteTable("trades", {
  id: text("id").primaryKey(),
  proposerEmail: text("proposer_email").notNull().references(() => users.email, { onDelete:"cascade" }),
  recipientEmail: text("recipient_email").notNull().references(() => users.email, { onDelete:"cascade" }),
  offeredCardId: text("offered_card_id").notNull().references(() => cards.id, { onDelete:"cascade" }),
  requestedCardId: text("requested_card_id").notNull().references(() => cards.id, { onDelete:"cascade" }),
  status: text("status", { enum:["pending","accepted","declined","cancelled"] }).notNull().default("pending"),
  createdAt: integer("created_at", { mode:"timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode:"timestamp_ms" }).notNull(),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete:"cascade" }),
  type: text("type", { enum:["friend","trade","pack","account","announcement"] }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull().default(""),
  destination: text("destination").notNull().default(""),
  referenceType: text("reference_type"),
  referenceId: text("reference_id"),
  readAt: integer("read_at", { mode:"timestamp_ms" }),
  createdAt: integer("created_at", { mode:"timestamp_ms" }).notNull(),
});

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  endpoint: text("endpoint").primaryKey(),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete:"cascade" }),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: integer("created_at", { mode:"timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode:"timestamp_ms" }).notNull(),
}, (table) => [index("idx_push_subscriptions_user_email").on(table.userEmail)]);

export const dailyExchangeOffers = sqliteTable("daily_exchange_offers", {
  day: text("day").notNull(),
  cardId: text("card_id").notNull().references(() => cards.id, { onDelete:"cascade" }),
}, (table) => [primaryKey({ columns:[table.day,table.cardId] }),index("idx_daily_exchange_offers_day").on(table.day)]);

export const collectionMilestoneClaims = sqliteTable("collection_milestone_claims", {
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete:"cascade" }),
  milestone: integer("milestone").notNull(),
  claimedAt: integer("claimed_at", { mode:"timestamp_ms" }).notNull(),
}, (table) => [primaryKey({ columns:[table.userEmail,table.milestone] })]);

export const predictionMatches = sqliteTable("prediction_matches", {
  id: text("id").primaryKey(),
  competition: text("competition").notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  kickoffAt: integer("kickoff_at", { mode:"timestamp_ms" }).notNull(),
  result: text("result", { enum:["home","draw","away"] }),
  createdAt: integer("created_at", { mode:"timestamp_ms" }).notNull(),
});

export const predictions = sqliteTable("predictions", {
  matchId: text("match_id").notNull().references(() => predictionMatches.id, { onDelete:"cascade" }),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete:"cascade" }),
  pick: text("pick", { enum:["home","draw","away"] }).notNull(),
  points: integer("points").notNull().default(0),
  createdAt: integer("created_at", { mode:"timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode:"timestamp_ms" }).notNull(),
}, (table) => [primaryKey({ columns:[table.matchId,table.userEmail] }),index("idx_predictions_user_email").on(table.userEmail)]);

export const predictionSyncs = sqliteTable("prediction_syncs", {
  id: text("id").primaryKey(),
  syncedAt: integer("synced_at", { mode:"timestamp_ms" }).notNull(),
});

export const announcements = sqliteTable("announcements", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  audience: text("audience", { enum:["all","selected"] }).notNull().default("all"),
  publishAt: integer("publish_at", { mode:"timestamp_ms" }).notNull(),
  createdBy: text("created_by").notNull().references(() => users.email),
  createdAt: integer("created_at", { mode:"timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode:"timestamp_ms" }).notNull(),
});

export const announcementRecipients = sqliteTable("announcement_recipients", {
  announcementId: text("announcement_id").notNull().references(() => announcements.id, { onDelete:"cascade" }),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete:"cascade" }),
}, (table) => [primaryKey({ columns:[table.announcementId,table.userEmail] })]);

export const blocks = sqliteTable("blocks", {
  blockerEmail: text("blocker_email").notNull().references(() => users.email, { onDelete:"cascade" }),
  blockedEmail: text("blocked_email").notNull().references(() => users.email, { onDelete:"cascade" }),
  createdAt: integer("created_at", { mode:"timestamp_ms" }).notNull(),
}, (table) => [primaryKey({ columns:[table.blockerEmail,table.blockedEmail] })]);

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  reporterEmail: text("reporter_email").notNull().references(() => users.email, { onDelete:"cascade" }),
  targetEmail: text("target_email").notNull().references(() => users.email, { onDelete:"cascade" }),
  reason: text("reason").notNull(),
  details: text("details").notNull().default(""),
  status: text("status", { enum:["open","resolved"] }).notNull().default("open"),
  createdAt: integer("created_at", { mode:"timestamp_ms" }).notNull(),
  resolvedAt: integer("resolved_at", { mode:"timestamp_ms" }),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: integer("created_at", { mode:"timestamp_ms" }).notNull(),
});
