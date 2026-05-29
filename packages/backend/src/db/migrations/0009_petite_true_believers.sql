CREATE TABLE `paper_citations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`paper_id` integer NOT NULL,
	`direction` text NOT NULL,
	`s2_paper_id` text,
	`corpus_id` text,
	`arxiv_id` text,
	`doi` text,
	`title` text,
	`authors` text,
	`year` integer,
	`venue` text,
	`url` text,
	`contexts` text,
	`intents` text,
	`is_influential` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `paper_citations_paper_dir_idx` ON `paper_citations` (`paper_id`,`direction`);