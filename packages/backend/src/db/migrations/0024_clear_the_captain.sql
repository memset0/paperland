ALTER TABLE `highlights` ADD `qa_result_id` integer REFERENCES qa_results(id);--> statement-breakpoint
CREATE INDEX `highlights_user_qa_result_idx` ON `highlights` (`user_id`,`qa_result_id`);--> statement-breakpoint
ALTER TABLE `qa_results` ADD `content_hash` text;