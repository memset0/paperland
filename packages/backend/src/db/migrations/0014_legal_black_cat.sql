-- notes-root-note: drop the walkthrough kind, introduce a single root note per (user, paper).
-- 1. Remove any stray walkthrough rows (the feature was never used).
DELETE FROM `notes` WHERE `kind` = 'walkthrough';
--> statement-breakpoint
-- 2. Create one empty root note for every (user, paper) that currently has a top-level note.
INSERT INTO `notes` (`user_id`, `paper_id`, `kind`, `parent_id`, `title`, `body`, `sort_order`, `created_at`, `updated_at`)
SELECT DISTINCT `user_id`, `paper_id`, 'root', NULL, NULL, '', 0,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `notes`
WHERE `kind` = 'note' AND `parent_id` IS NULL;
--> statement-breakpoint
-- 3. Reparent former top-level notes under their paper's new root note.
UPDATE `notes`
SET `parent_id` = (
  SELECT `r`.`id` FROM `notes` `r`
  WHERE `r`.`user_id` = `notes`.`user_id` AND `r`.`paper_id` = `notes`.`paper_id` AND `r`.`kind` = 'root'
)
WHERE `kind` = 'note' AND `parent_id` IS NULL;
--> statement-breakpoint
-- 4. Enforce at most one root note per (user, paper).
CREATE UNIQUE INDEX `notes_root_unq` ON `notes` (`user_id`,`paper_id`) WHERE "notes"."kind" = 'root';