CREATE TABLE `admin_google_identities` (
	`google_sub` text PRIMARY KEY NOT NULL,
	`admin_email` text NOT NULL,
	`google_email` text,
	`google_name` text,
	`created_at` integer NOT NULL,
	`last_verified_at` integer,
	FOREIGN KEY (`admin_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_google_identities_admin_email_unique` ON `admin_google_identities` (`admin_email`);