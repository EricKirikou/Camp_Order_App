CREATE TABLE `campus_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(100) NOT NULL,
	`name` varchar(180) NOT NULL,
	`category` varchar(80) NOT NULL,
	`description` text,
	`startingPricePesewas` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`isSample` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campus_services_id` PRIMARY KEY(`id`),
	CONSTRAINT `campus_services_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `campuses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(80) NOT NULL,
	`name` varchar(180) NOT NULL,
	`city` varchar(100) NOT NULL,
	`region` varchar(100) NOT NULL,
	`description` text,
	`isSample` int NOT NULL DEFAULT 1,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campuses_id` PRIMARY KEY(`id`),
	CONSTRAINT `campuses_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `cart_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cartId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cart_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `cart_product_unique` UNIQUE(`cartId`,`productId`)
);
--> statement-breakpoint
CREATE TABLE `carts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`campusId` int NOT NULL,
	`status` enum('active','checked_out','abandoned') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `carts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `errands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`campusId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`details` text NOT NULL,
	`pickupLocation` varchar(255),
	`dropoffLocation` varchar(255),
	`quotedPricePesewas` int,
	`status` enum('submitted','quoted','accepted','in_progress','completed','cancelled') NOT NULL DEFAULT 'submitted',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `errands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`productName` varchar(180) NOT NULL,
	`unitPricePesewas` int NOT NULL,
	`quantity` int NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderCode` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`campusId` int NOT NULL,
	`status` enum('payment_pending','placed','accepted','preparing','on_the_way','completed','cancelled') NOT NULL DEFAULT 'payment_pending',
	`paymentStatus` enum('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
	`isSample` int NOT NULL DEFAULT 0,
	`subtotalPesewas` int NOT NULL,
	`deliveryFeePesewas` int NOT NULL,
	`totalPesewas` int NOT NULL,
	`deliveryAddress` text NOT NULL,
	`customerEmail` varchar(320) NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderCode_unique` UNIQUE(`orderCode`)
);
--> statement-breakpoint
CREATE TABLE `otp_challenges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phoneNumber` varchar(20) NOT NULL,
	`userId` int,
	`purpose` enum('signup','login') NOT NULL,
	`codeHash` varchar(128) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `otp_challenges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerEventId` varchar(150) NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_webhook_events_providerEventId_unique` UNIQUE(`providerEventId`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`reference` varchar(100) NOT NULL,
	`amountPesewas` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'GHS',
	`status` enum('initialized','pending','success','failed','reversed') NOT NULL DEFAULT 'initialized',
	`authorizationUrl` varchar(512),
	`verifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(100) NOT NULL,
	`vendorId` int,
	`category` varchar(100) NOT NULL,
	`name` varchar(180) NOT NULL,
	`description` text,
	`pricePesewas` int NOT NULL,
	`imageUrl` varchar(512),
	`badge` varchar(80),
	`isAvailable` int NOT NULL DEFAULT 1,
	`isSample` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `service_bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`campusId` int NOT NULL,
	`serviceId` int NOT NULL,
	`requestedAt` timestamp NOT NULL,
	`details` text,
	`quotedPricePesewas` int,
	`status` enum('pending_confirmation','confirmed','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending_confirmation',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(80) NOT NULL,
	`campusId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`category` varchar(80) NOT NULL,
	`description` text,
	`ratingHundredths` int NOT NULL DEFAULT 0,
	`etaMin` int NOT NULL DEFAULT 25,
	`deliveryFeePesewas` int NOT NULL DEFAULT 0,
	`isOpen` int NOT NULL DEFAULT 1,
	`isSample` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vendors_id` PRIMARY KEY(`id`),
	CONSTRAINT `vendors_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `phoneNumber` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `phoneVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `campusId` int;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_phoneNumber_unique` UNIQUE(`phoneNumber`);--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_cartId_carts_id_fk` FOREIGN KEY (`cartId`) REFERENCES `carts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `carts` ADD CONSTRAINT `carts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `carts` ADD CONSTRAINT `carts_campusId_campuses_id_fk` FOREIGN KEY (`campusId`) REFERENCES `campuses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `errands` ADD CONSTRAINT `errands_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `errands` ADD CONSTRAINT `errands_campusId_campuses_id_fk` FOREIGN KEY (`campusId`) REFERENCES `campuses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_campusId_campuses_id_fk` FOREIGN KEY (`campusId`) REFERENCES `campuses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `otp_challenges` ADD CONSTRAINT `otp_challenges_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_vendorId_vendors_id_fk` FOREIGN KEY (`vendorId`) REFERENCES `vendors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_bookings` ADD CONSTRAINT `service_bookings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_bookings` ADD CONSTRAINT `service_bookings_campusId_campuses_id_fk` FOREIGN KEY (`campusId`) REFERENCES `campuses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_bookings` ADD CONSTRAINT `service_bookings_serviceId_campus_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `campus_services`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vendors` ADD CONSTRAINT `vendors_campusId_campuses_id_fk` FOREIGN KEY (`campusId`) REFERENCES `campuses`(`id`) ON DELETE no action ON UPDATE no action;