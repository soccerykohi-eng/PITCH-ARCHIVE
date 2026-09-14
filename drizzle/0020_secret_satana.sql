CREATE TABLE `google_identities` (
	`google_sub` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`google_email` text,
	`google_name` text,
	`created_at` integer NOT NULL,
	`last_login_at` integer,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `google_identities_user_email_unique` ON `google_identities` (`user_email`);