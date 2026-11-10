CREATE TABLE `topic_members` (
	`topic_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`mcp_call_counts` text DEFAULT '{}' NOT NULL,
	PRIMARY KEY(`topic_id`, `user_id`),
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `topic_members_user_idx` ON `topic_members` (`user_id`,`active`);--> statement-breakpoint
CREATE TABLE `topic_nodes` (
	`topic_id` integer NOT NULL,
	`node_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`topic_id`, `node_id`),
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `topic_papers` (
	`topic_id` integer NOT NULL,
	`node_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`paper_id` integer,
	`s2_id` text,
	PRIMARY KEY(`topic_id`, `node_id`, `entry_id`),
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `topic_papers_paper_idx` ON `topic_papers` (`paper_id`);--> statement-breakpoint
CREATE TABLE `topic_pushes` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` integer NOT NULL,
	`user_id` integer,
	`token_id` integer,
	`uploader_name` text NOT NULL,
	`old_commit` text,
	`new_commit` text NOT NULL,
	`pushed_at` text NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topic_pushes_commit_unq` ON `topic_pushes` (`topic_id`,`new_commit`);--> statement-breakpoint
CREATE TABLE `topic_versions` (
	`topic_id` integer NOT NULL,
	`commit` text NOT NULL,
	`parent_commit` text,
	`message` text NOT NULL,
	`author_name` text NOT NULL,
	`author_email` text NOT NULL,
	`committer_name` text NOT NULL,
	`committer_email` text NOT NULL,
	`committed_at` text NOT NULL,
	`push_id` text NOT NULL,
	PRIMARY KEY(`topic_id`, `commit`),
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`push_id`) REFERENCES `topic_pushes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`published_commit` text,
	`snapshot` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `api_tokens` ADD `topic_id` integer REFERENCES topics(id);--> statement-breakpoint
ALTER TABLE `users` ADD `mcp_call_counts` text DEFAULT '{}' NOT NULL;