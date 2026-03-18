ALTER TABLE `qa_entries` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `qa_entries` ADD `error` text;