CREATE TABLE `highlights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pathname` text NOT NULL,
	`content_hash` text NOT NULL,
	`start_offset` integer NOT NULL,
	`end_offset` integer NOT NULL,
	`text` text NOT NULL,
	`color` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
