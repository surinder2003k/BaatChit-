CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`senderName` varchar(80) NOT NULL,
	`kind` enum('text','image','video') NOT NULL,
	`body` text,
	`mediaUrl` text,
	`mediaName` varchar(255),
	`mediaType` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `chat_sessions_id` PRIMARY KEY(`id`)
);
