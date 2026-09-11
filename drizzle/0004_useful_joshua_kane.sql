CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`destination` text DEFAULT '' NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
