CREATE TABLE `collection_milestone_claims` (
	`user_email` text NOT NULL,
	`milestone` integer NOT NULL,
	`claimed_at` integer NOT NULL,
	PRIMARY KEY(`user_email`, `milestone`),
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
