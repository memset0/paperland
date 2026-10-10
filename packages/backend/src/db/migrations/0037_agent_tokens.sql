ALTER TABLE `api_tokens` ADD `kind` text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE `api_tokens` ADD `rotated_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_agent_user_unq` ON `api_tokens` (`user_id`) WHERE kind = 'agent';--> statement-breakpoint
INSERT INTO `api_tokens` (`token`, `user_id`, `kind`, `created_at`)
SELECT 'sk-' || lower(hex(randomblob(32))), `id`, 'agent', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users` WHERE `status` = 'active'
  AND NOT EXISTS (SELECT 1 FROM `api_tokens` t WHERE t.`user_id` = `users`.`id` AND t.`kind` = 'agent');
