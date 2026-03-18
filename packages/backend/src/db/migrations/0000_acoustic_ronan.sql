CREATE TABLE `api_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_unique` ON `api_tokens` (`token`);--> statement-breakpoint
CREATE TABLE `paper_tags` (
	`paper_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`paper_id`, `tag_id`),
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `papers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`arxiv_id` text,
	`corpus_id` text,
	`title` text NOT NULL,
	`authors` text NOT NULL,
	`abstract` text,
	`contents` text,
	`pdf_path` text,
	`metadata` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `papers_arxiv_id_unique` ON `papers` (`arxiv_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `papers_corpus_id_unique` ON `papers` (`corpus_id`);--> statement-breakpoint
CREATE TABLE `qa_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`paper_id` integer NOT NULL,
	`type` text NOT NULL,
	`template_name` text,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `qa_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`qa_entry_id` integer NOT NULL,
	`prompt` text NOT NULL,
	`answer` text NOT NULL,
	`model_name` text NOT NULL,
	`completed_at` text NOT NULL,
	FOREIGN KEY (`qa_entry_id`) REFERENCES `qa_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `service_executions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`service_name` text NOT NULL,
	`paper_id` integer NOT NULL,
	`status` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`finished_at` text,
	`result` text,
	`error` text,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);