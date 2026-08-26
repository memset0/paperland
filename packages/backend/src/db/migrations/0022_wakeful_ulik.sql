ALTER TABLE `qa_entries` ADD `prompt` text;--> statement-breakpoint
UPDATE `qa_entries`
SET `prompt` = (
	SELECT `qa_results`.`prompt`
	FROM `qa_results`
	WHERE `qa_results`.`qa_entry_id` = `qa_entries`.`id`
	ORDER BY `qa_results`.`completed_at` DESC, `qa_results`.`id` DESC
	LIMIT 1
)
WHERE `qa_entries`.`prompt` IS NULL
	AND EXISTS (
		SELECT 1 FROM `qa_results`
		WHERE `qa_results`.`qa_entry_id` = `qa_entries`.`id`
	);
