CREATE TABLE `daily_exchange_offers` (
	`day` text NOT NULL,
	`card_id` text NOT NULL,
	PRIMARY KEY(`day`, `card_id`),
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_daily_exchange_offers_day` ON `daily_exchange_offers` (`day`);