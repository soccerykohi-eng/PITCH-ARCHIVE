ALTER TABLE `users` ADD `friend_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_friend_id_unique` ON `users` (`friend_id`);