ALTER TABLE `chat_messages` ADD `replyToId` int;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `replyToSender` varchar(80);--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `replyToBody` text;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `reactions` text;