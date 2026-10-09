CREATE TABLE `s2_papers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`s2_paper_id` text,
	`corpus_id` text,
	`arxiv_id` text,
	`doi` text,
	`title` text,
	`authors` text,
	`year` integer,
	`venue` text,
	`abstract` text,
	`tldr` text,
	`citation_count` integer,
	`influential_citation_count` integer,
	`reference_count` integer,
	`publication_date` text,
	`url` text,
	`open_access_pdf_url` text,
	`status` text NOT NULL,
	`fetched_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `s2_papers_s2_paper_id_unique` ON `s2_papers` (`s2_paper_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `s2_papers_corpus_id_unique` ON `s2_papers` (`corpus_id`);