ALTER TABLE `papers` ADD `link` text;
UPDATE `papers` SET `link` = 'https://arxiv.org/abs/' || `arxiv_id` WHERE `arxiv_id` IS NOT NULL AND `link` IS NULL;