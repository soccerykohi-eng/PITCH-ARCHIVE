CREATE TABLE `prediction_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`competition` text NOT NULL,
	`home_team` text NOT NULL,
	`away_team` text NOT NULL,
	`kickoff_at` integer NOT NULL,
	`result` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `predictions` (
	`match_id` text NOT NULL,
	`user_email` text NOT NULL,
	`pick` text NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`match_id`, `user_email`),
	FOREIGN KEY (`match_id`) REFERENCES `prediction_matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_predictions_user_email` ON `predictions` (`user_email`);