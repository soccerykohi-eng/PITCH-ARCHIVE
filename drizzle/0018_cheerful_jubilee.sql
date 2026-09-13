CREATE TABLE `passkey_credentials` (
	`credential_id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`public_key` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`transports` text DEFAULT '[]' NOT NULL,
	`device_type` text DEFAULT '' NOT NULL,
	`backed_up` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_passkey_credentials_user_email` ON `passkey_credentials` (`user_email`);