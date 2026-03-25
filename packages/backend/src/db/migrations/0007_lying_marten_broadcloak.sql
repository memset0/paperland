ALTER TABLE `papers` ADD `tags_json` text;--> statement-breakpoint
ALTER TABLE `tags` ADD `color` text DEFAULT '' NOT NULL;