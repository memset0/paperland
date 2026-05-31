CREATE TABLE `translations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_hash` text NOT NULL,
	`source_text` text NOT NULL,
	`source_lang` text DEFAULT 'en' NOT NULL,
	`target_lang` text DEFAULT 'zh' NOT NULL,
	`translated_text` text NOT NULL,
	`model_name` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `translations_hash_lang_idx` ON `translations` (`source_hash`,`target_lang`);--> statement-breakpoint
CREATE INDEX `translations_hash_idx` ON `translations` (`source_hash`);