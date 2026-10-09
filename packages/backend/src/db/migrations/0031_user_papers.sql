CREATE TABLE `user_papers` (
	`user_id` integer NOT NULL,
	`paper_id` integer NOT NULL,
	`in_library` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `paper_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_papers_paper_idx` ON `user_papers` (`paper_id`);--> statement-breakpoint
-- Backfill: each existing user's library = the starter paper + every paper they interacted with.
INSERT OR IGNORE INTO `user_papers` (`user_id`, `paper_id`, `in_library`, `created_at`, `updated_at`)
SELECT DISTINCT s.user_id, s.paper_id, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (
	SELECT u.id AS user_id, p.id AS paper_id FROM users u, papers p WHERE p.arxiv_id = '1706.03762'
	UNION SELECT t.user_id, pt.paper_id FROM paper_tags pt JOIN tags t ON t.id = pt.tag_id
	UNION SELECT user_id, paper_id FROM notes
	UNION SELECT user_id, paper_id FROM qa_entries WHERE type = 'free'
	UNION SELECT r.requested_by_user_id, e.paper_id FROM qa_results r JOIN qa_entries e ON e.id = r.qa_entry_id
	UNION SELECT h.user_id, e.paper_id FROM highlights h JOIN qa_results r ON r.id = h.qa_result_id JOIN qa_entries e ON e.id = r.qa_entry_id
	UNION SELECT user_id, CAST(substr(pathname, 9) AS INTEGER) FROM highlights WHERE pathname LIKE '/papers/%'
	UNION SELECT user_id, paper_id FROM paper_reference_links
) s
WHERE s.user_id IN (SELECT id FROM users) AND s.paper_id IN (SELECT id FROM papers);
