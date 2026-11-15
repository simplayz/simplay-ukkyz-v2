CREATE TABLE `assaults` (
	`id` text PRIMARY KEY,
	`parcel_id` text NOT NULL,
	`report` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_assaults_parcel_id_parcels_id_fk` FOREIGN KEY (`parcel_id`) REFERENCES `parcels`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `bots` (
	`id` text PRIMARY KEY,
	`pilot_id` text NOT NULL,
	`role` text NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`directive` text NOT NULL,
	`autonomy` integer DEFAULT 35 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_bots_pilot_id_pilots_id_fk` FOREIGN KEY (`pilot_id`) REFERENCES `pilots`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `buildings` (
	`id` text PRIMARY KEY,
	`parcel_id` text NOT NULL,
	`structure_id` text,
	`name` text NOT NULL,
	`archetype` text NOT NULL,
	`gx` integer NOT NULL,
	`gy` integer NOT NULL,
	`width` integer DEFAULT 3 NOT NULL,
	`depth` integer DEFAULT 3 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_buildings_parcel_id_parcels_id_fk` FOREIGN KEY (`parcel_id`) REFERENCES `parcels`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_buildings_structure_id_structures_id_fk` FOREIGN KEY (`structure_id`) REFERENCES `structures`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`pilot_id` text NOT NULL,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`payload` text,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_events_pilot_id_pilots_id_fk` FOREIGN KEY (`pilot_id`) REFERENCES `pilots`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `parcels` (
	`id` text PRIMARY KEY,
	`pilot_id` text NOT NULL UNIQUE,
	`name` text NOT NULL,
	`seed` integer NOT NULL,
	`center_x` real NOT NULL,
	`center_y` real NOT NULL,
	`lat` real NOT NULL,
	`lon` real NOT NULL,
	`area_m2` integer NOT NULL,
	`scores` text NOT NULL,
	`cells` text NOT NULL,
	`locked_until` integer NOT NULL,
	`last_tick_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_parcels_pilot_id_pilots_id_fk` FOREIGN KEY (`pilot_id`) REFERENCES `pilots`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `pilots` (
	`id` text PRIMARY KEY,
	`call_sign` text NOT NULL UNIQUE,
	`seed` integer NOT NULL,
	`home_lat` real NOT NULL,
	`home_lon` real NOT NULL,
	`credits` integer DEFAULT 15000 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY,
	`building_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	`width` integer DEFAULT 2 NOT NULL,
	`depth` integer DEFAULT 2 NOT NULL,
	`staff` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_rooms_building_id_buildings_id_fk` FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `structures` (
	`id` text PRIMARY KEY,
	`parcel_id` text NOT NULL,
	`type` text NOT NULL,
	`gx` integer NOT NULL,
	`gy` integer NOT NULL,
	`rotation` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_structures_parcel_id_parcels_id_fk` FOREIGN KEY (`parcel_id`) REFERENCES `parcels`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `tile_cache` (
	`z` integer NOT NULL,
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	`png_base64` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`source` text DEFAULT 'osm' NOT NULL,
	CONSTRAINT `tile_cache_pk` PRIMARY KEY(`z`, `x`, `y`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bots_role_idx` ON `bots` (`pilot_id`,`role`);--> statement-breakpoint
CREATE INDEX `events_pilot_idx` ON `events` (`pilot_id`,`id`);--> statement-breakpoint
CREATE INDEX `parcels_lock_idx` ON `parcels` (`locked_until`);--> statement-breakpoint
CREATE UNIQUE INDEX `structures_cell_idx` ON `structures` (`parcel_id`,`gx`,`gy`);