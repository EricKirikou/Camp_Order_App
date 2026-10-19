ALTER TABLE `otp_challenges` ADD `resendTokenHash` varchar(64) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `failedLoginAttempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `loginLockedUntil` timestamp;