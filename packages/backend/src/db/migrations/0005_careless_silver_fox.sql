ALTER TABLE `papers` ADD `updated_at` text NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE `papers` SET `updated_at` = `created_at` WHERE `updated_at` = '';
