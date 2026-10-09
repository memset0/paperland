CREATE TABLE `user_sharing_settings` (
	`user_id` integer NOT NULL,
	`data_type` text NOT NULL,
	`shared` integer NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `data_type`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
