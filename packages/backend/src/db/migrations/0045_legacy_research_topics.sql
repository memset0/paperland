ALTER TABLE `topic_versions` ADD `legacy_research_step_id` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `topic_versions_legacy_step_unq` ON `topic_versions` (`legacy_research_step_id`);--> statement-breakpoint
ALTER TABLE `topics` ADD `legacy_research_session_id` integer;--> statement-breakpoint
ALTER TABLE `topics` ADD `legacy_migration_state` text;--> statement-breakpoint
ALTER TABLE `topics` ADD `legacy_migration_plan` text;--> statement-breakpoint
CREATE UNIQUE INDEX `topics_legacy_session_unq` ON `topics` (`legacy_research_session_id`);