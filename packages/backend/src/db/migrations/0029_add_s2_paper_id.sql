ALTER TABLE `papers` ADD `s2_paper_id` text;--> statement-breakpoint
-- Backfill from metadata.s2_url (https://www.semanticscholar.org/paper/<40-hex>), one row per value.
UPDATE `papers` SET `s2_paper_id` = lower(substr(json_extract(`metadata`, '$.s2_url'), 39))
WHERE json_valid(`metadata`)
  AND json_extract(`metadata`, '$.s2_url') LIKE 'https://www.semanticscholar.org/paper/%'
  AND length(json_extract(`metadata`, '$.s2_url')) = 78
  AND `id` IN (
    SELECT min(`id`) FROM `papers`
    WHERE json_valid(`metadata`) AND json_extract(`metadata`, '$.s2_url') IS NOT NULL
    GROUP BY json_extract(`metadata`, '$.s2_url')
  );--> statement-breakpoint
CREATE UNIQUE INDEX `papers_s2_paper_id_unique` ON `papers` (`s2_paper_id`);
