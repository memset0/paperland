CREATE TABLE `qa_result_cites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`qa_result_id` integer NOT NULL,
	`paper_id` integer NOT NULL,
	`cite_id` text NOT NULL,
	`id_kind` text NOT NULL,
	`link_text` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`qa_result_id`) REFERENCES `qa_results`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `qa_result_cites_paper_idx` ON `qa_result_cites` (`paper_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `qa_result_cites_result_cite_unique` ON `qa_result_cites` (`qa_result_id`,`cite_id`);--> statement-breakpoint
ALTER TABLE `qa_entries` ADD `instruction` text;--> statement-breakpoint
ALTER TABLE `qa_entries` ADD `inputs` text;--> statement-breakpoint
ALTER TABLE `qa_entries` ADD `parent_entry_id` integer;--> statement-breakpoint
CREATE INDEX `qa_entries_parent_entry_idx` ON `qa_entries` (`parent_entry_id`);--> statement-breakpoint
ALTER TABLE `qa_results` ADD `deleted_at` text;