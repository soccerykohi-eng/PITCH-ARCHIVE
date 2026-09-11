CREATE TABLE `friendships` (
	`user_a_email` text NOT NULL,
	`user_b_email` text NOT NULL,
	`requested_by` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_a_email`, `user_b_email`),
	FOREIGN KEY (`user_a_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_b_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` text PRIMARY KEY NOT NULL,
	`proposer_email` text NOT NULL,
	`recipient_email` text NOT NULL,
	`offered_card_id` text NOT NULL,
	`requested_card_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`proposer_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`offered_card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
