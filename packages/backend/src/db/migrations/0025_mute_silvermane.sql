ALTER TABLE `qa_results` ADD `status` text DEFAULT 'done' NOT NULL;--> statement-breakpoint
ALTER TABLE `qa_results` ADD `error` text;--> statement-breakpoint
ALTER TABLE `qa_results` ADD `requested_by_user_id` integer REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `qa_results` ADD `streaming_capable` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `qa_results` ADD `created_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `qa_results` ADD `started_at` text;--> statement-breakpoint
ALTER TABLE `qa_results` ADD `first_chunk_at` text;--> statement-breakpoint
ALTER TABLE `qa_results` ADD `finished_at` text;--> statement-breakpoint
ALTER TABLE `qa_results` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `qa_results`
SET `created_at` = `completed_at`,
    `finished_at` = `completed_at`,
    `updated_at` = `completed_at`
WHERE `status` = 'done';
