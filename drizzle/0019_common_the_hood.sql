PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_pack_claims` (
	`user_email` text NOT NULL,
	`pack_id` text NOT NULL,
	`card_id` text,
	`claimed_at` integer NOT NULL,
	PRIMARY KEY(`user_email`, `pack_id`),
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pack_id`) REFERENCES `packs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_pack_claims`("user_email", "pack_id", "card_id", "claimed_at") SELECT "user_email", "pack_id", "card_id", "claimed_at" FROM `pack_claims`;--> statement-breakpoint
DROP TABLE `pack_claims`;--> statement-breakpoint
ALTER TABLE `__new_pack_claims` RENAME TO `pack_claims`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_pack_openings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`pack_id` text NOT NULL,
	`card_id` text,
	`opened_at` integer NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pack_id`) REFERENCES `packs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_pack_openings`("id", "user_email", "pack_id", "card_id", "opened_at") SELECT "id", "user_email", "pack_id", "card_id", "opened_at" FROM `pack_openings`;--> statement-breakpoint
DROP TABLE `pack_openings`;--> statement-breakpoint
ALTER TABLE `__new_pack_openings` RENAME TO `pack_openings`;--> statement-breakpoint
CREATE INDEX `idx_pack_openings_user_pack` ON `pack_openings` (`user_email`,`pack_id`);