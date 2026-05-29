CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
DROP INDEX `tags_name_unique`;--> statement-breakpoint
ALTER TABLE `tags` ADD `user_id` integer REFERENCES users(id);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_user_name_unq` ON `tags` (`user_id`,`name`);--> statement-breakpoint
ALTER TABLE `api_tokens` ADD `user_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `highlights` ADD `user_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `qa_entries` ADD `user_id` integer REFERENCES users(id);