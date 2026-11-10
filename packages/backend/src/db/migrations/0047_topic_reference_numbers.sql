CREATE TABLE `topic_references` (
	`topic_id` integer NOT NULL,
	`entry_id` text NOT NULL,
	`reference_number` integer NOT NULL,
	`source_key` text NOT NULL,
	`first_commit` text NOT NULL,
	`added_at` text NOT NULL,
	PRIMARY KEY(`topic_id`, `entry_id`),
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topic_references_number_unq` ON `topic_references` (`topic_id`,`reference_number`);--> statement-breakpoint
ALTER TABLE `topics` ADD `references_indexed_commit` text;