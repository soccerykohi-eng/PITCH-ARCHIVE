ALTER TABLE `packs` ADD `point_cost` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `points` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `last_daily_bonus` text DEFAULT '' NOT NULL;