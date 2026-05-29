CREATE TABLE `conference_papers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conference_id` integer NOT NULL,
	`title` text NOT NULL,
	`topic` text,
	`authors` text,
	`abstract` text,
	`source` text,
	`external_id` text,
	`link` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`paper_id` integer,
	`metadata` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`conference_id`) REFERENCES `conferences`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `conference_papers_conf_status_idx` ON `conference_papers` (`conference_id`,`status`);--> statement-breakpoint
CREATE TABLE `conferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`year` integer,
	`start_date` text,
	`end_date` text,
	`location` text,
	`description` text,
	`link` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
