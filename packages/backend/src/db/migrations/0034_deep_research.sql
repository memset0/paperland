CREATE TABLE `research_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`topic` text NOT NULL,
	`seed` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `research_sessions_user_idx` ON `research_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `research_steps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`step_index` integer NOT NULL,
	`kind` text NOT NULL,
	`user_text` text,
	`model_name` text,
	`status` text NOT NULL,
	`answer` text DEFAULT '' NOT NULL,
	`report` text,
	`changes_note` text,
	`paper_list` text,
	`parse_error` text,
	`repaired` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` text NOT NULL,
	`started_at` text,
	`first_chunk_at` text,
	`finished_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `research_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `research_steps_session_step_unq` ON `research_steps` (`session_id`,`step_index`);