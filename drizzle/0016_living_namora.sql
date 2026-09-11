CREATE TABLE `pack_openings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`pack_id` text NOT NULL,
	`card_id` text NOT NULL,
	`opened_at` integer NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pack_id`) REFERENCES `packs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pack_openings_user_pack` ON `pack_openings` (`user_email`,`pack_id`);--> statement-breakpoint
ALTER TABLE `packs` ADD `publish_at` integer;--> statement-breakpoint
ALTER TABLE `packs` ADD `end_at` integer;--> statement-breakpoint
ALTER TABLE `packs` ADD `open_limit` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `packs` ADD `notification_message` text DEFAULT '' NOT NULL;