CREATE TABLE `qa_user_preferences` (
	`user_id` integer NOT NULL,
	`qa_entry_id` integer NOT NULL,
	`background_color` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `qa_entry_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`qa_entry_id`) REFERENCES `qa_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `qa_user_preferences_entry_idx` ON `qa_user_preferences` (`qa_entry_id`);