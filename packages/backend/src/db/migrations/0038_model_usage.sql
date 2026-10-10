CREATE TABLE `model_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`user_id` integer,
	`qa_result_id` integer,
	`research_step_id` integer,
	`translation_id` integer,
	`model_name` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`cached_input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`reasoning_tokens` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` real,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`qa_result_id`) REFERENCES `qa_results`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`research_step_id`) REFERENCES `research_steps`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`translation_id`) REFERENCES `translations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `model_usage_user_idx` ON `model_usage` (`user_id`);--> statement-breakpoint
CREATE INDEX `model_usage_created_idx` ON `model_usage` (`created_at`);