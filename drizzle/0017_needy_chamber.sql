CREATE TABLE `daily_mission_events` (
	`user_email` text NOT NULL,
	`event_date` text NOT NULL,
	`event_type` text NOT NULL,
	`reference_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_email`, `event_date`, `event_type`, `reference_id`),
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_daily_mission_events_user_date` ON `daily_mission_events` (`user_email`,`event_date`);--> statement-breakpoint
CREATE TABLE `mission_reward_claims` (
	`user_email` text NOT NULL,
	`period_key` text NOT NULL,
	`reward_key` text NOT NULL,
	`claimed_at` integer NOT NULL,
	PRIMARY KEY(`user_email`, `period_key`, `reward_key`),
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_mission_reward_claims_week` ON `mission_reward_claims` (`user_email`,`reward_key`,`period_key`);