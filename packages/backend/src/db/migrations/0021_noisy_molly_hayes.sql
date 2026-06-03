PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_paper_reference_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`paper_id` integer NOT NULL,
	`title` text,
	`url` text NOT NULL,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_paper_reference_links`("id", "user_id", "paper_id", "title", "url", "description", "created_at", "updated_at") SELECT "id", "user_id", "paper_id", "title", "url", "description", "created_at", "updated_at" FROM `paper_reference_links`;--> statement-breakpoint
DROP TABLE `paper_reference_links`;--> statement-breakpoint
ALTER TABLE `__new_paper_reference_links` RENAME TO `paper_reference_links`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_paper_reference_links_paper_user` ON `paper_reference_links` (`paper_id`,`user_id`);