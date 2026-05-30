CREATE TABLE `images` (
	`hash` text PRIMARY KEY NOT NULL,
	`ext` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`path` text NOT NULL,
	`original_name` text,
	`uploaded_by` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_images_created` ON `images` (`created_at`);--> statement-breakpoint
ALTER TABLE `highlights` DROP COLUMN `note`;