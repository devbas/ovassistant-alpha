# ************************************************************
# Sequel Pro SQL dump
# Version 4541
#
# http://www.sequelpro.com/
# https://github.com/sequelpro/sequelpro
#
# Host: 127.0.0.1 (MySQL 5.7.23)
# Database: ovassistant
# Generation Time: 2019-02-24 17:34:13 +0000
# ************************************************************


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


# Dump of table agency
# ------------------------------------------------------------

DROP TABLE IF EXISTS `agency`;

CREATE TABLE `agency` (
  `agency_id` varchar(255) DEFAULT NULL,
  `agency_name` varchar(255) DEFAULT NULL,
  `agency_url` varchar(255) DEFAULT NULL,
  `agency_timezone` varchar(255) DEFAULT NULL,
  `agency_phone` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Dump of table calendar_dates
# ------------------------------------------------------------

DROP TABLE IF EXISTS `calendar_dates`;

CREATE TABLE `calendar_dates` (
  `service_id` int(11) DEFAULT NULL,
  `date` int(11) DEFAULT NULL,
  `exception_type` int(11) DEFAULT NULL,
  KEY `service_id_index` (`service_id`),
  KEY `date_index` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Dump of table organisation
# ------------------------------------------------------------

DROP TABLE IF EXISTS `organisation`;

CREATE TABLE `organisation` (
  `organisation_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `organisation` int(11) DEFAULT NULL,
  `max_users` int(11) DEFAULT '5',
  `created` datetime DEFAULT NULL,
  `updated` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `email` varchar(255) DEFAULT NULL,
  `password` text,
  PRIMARY KEY (`organisation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Dump of table routes
# ------------------------------------------------------------

DROP TABLE IF EXISTS `routes`;

CREATE TABLE `routes` (
  `route_id` int(11) DEFAULT NULL,
  `agency_id` varchar(255) DEFAULT NULL,
  `route_short_name` varchar(255) DEFAULT NULL,
  `route_long_name` varchar(255) DEFAULT NULL,
  `route_desc` varchar(255) DEFAULT NULL,
  `route_type` int(11) DEFAULT NULL,
  `route_color` varchar(255) DEFAULT NULL,
  `route_text_color` varchar(255) DEFAULT NULL,
  `route_url` varchar(255) DEFAULT NULL,
  KEY `route_id_index` (`route_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Dump of table shapes
# ------------------------------------------------------------

DROP TABLE IF EXISTS `shapes`;

CREATE TABLE `shapes` (
  `shape_id` int(11) DEFAULT NULL,
  `shape_pt_sequence` int(11) DEFAULT NULL,
  `shape_pt_lat` varchar(255) DEFAULT NULL,
  `shape_pt_lon` varchar(255) DEFAULT NULL,
  `shape_dist_traveled` int(11) DEFAULT NULL,
  KEY `shape_id` (`shape_id`),
  KEY `shape_id_index` (`shape_id`),
  KEY `shape_dist_traveled_index` (`shape_dist_traveled`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Dump of table stop_times
# ------------------------------------------------------------

DROP TABLE IF EXISTS `stop_times`;

CREATE TABLE `stop_times` (
  `trip_id` int(11) DEFAULT NULL,
  `stop_sequence` int(11) DEFAULT NULL,
  `stop_id` int(11) DEFAULT NULL,
  `stop_headsign` varchar(255) DEFAULT NULL,
  `arrival_time` varchar(255) DEFAULT NULL,
  `departure_time` varchar(255) DEFAULT NULL,
  `pickup_type` int(11) DEFAULT NULL,
  `drop_off_type` int(11) DEFAULT NULL,
  `timepoint` int(11) DEFAULT NULL,
  `shape_dist_traveled` int(11) DEFAULT NULL,
  `fare_units_traveled` int(11) DEFAULT NULL,
  KEY `trip_id_index` (`trip_id`),
  KEY `stop_id_index` (`stop_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Dump of table stops
# ------------------------------------------------------------

DROP TABLE IF EXISTS `stops`;

CREATE TABLE `stops` (
  `stop_id` varchar(255) DEFAULT NULL,
  `stop_code` varchar(255) DEFAULT NULL,
  `stop_name` varchar(255) DEFAULT NULL,
  `stop_lat` varchar(255) DEFAULT NULL,
  `stop_lon` varchar(255) DEFAULT NULL,
  `location_type` int(11) DEFAULT NULL,
  `parent_station` varchar(255) DEFAULT NULL,
  `stop_timezone` varchar(255) DEFAULT NULL,
  `wheelchair_boarding` varchar(255) DEFAULT NULL,
  `platform_code` varchar(255) DEFAULT NULL,
  `zone_id` varchar(255) DEFAULT NULL,
  KEY `stop_id_index` (`stop_id`),
  KEY `parent_station_index` (`parent_station`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Dump of table transfers
# ------------------------------------------------------------

DROP TABLE IF EXISTS `transfers`;

CREATE TABLE `transfers` (
  `from_stop_id` int(11) DEFAULT NULL,
  `to_stop_id` int(11) DEFAULT NULL,
  `from_route_id` varchar(255) DEFAULT NULL,
  `to_route_id` varchar(255) DEFAULT NULL,
  `from_trip_id` int(11) DEFAULT NULL,
  `to_trip_id` int(11) DEFAULT NULL,
  `transfer_type` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Dump of table trips
# ------------------------------------------------------------

DROP TABLE IF EXISTS `trips`;

CREATE TABLE `trips` (
  `route_id` int(11) DEFAULT NULL,
  `service_id` int(11) DEFAULT NULL,
  `trip_id` int(11) DEFAULT NULL,
  `realtime_trip_id` varchar(255) DEFAULT NULL,
  `trip_headsign` varchar(255) DEFAULT NULL,
  `trip_short_name` int(11) DEFAULT NULL,
  `trip_long_name` varchar(255) DEFAULT NULL,
  `direction_id` int(11) DEFAULT NULL,
  `block_id` varchar(255) DEFAULT NULL,
  `shape_id` int(11) DEFAULT NULL,
  `wheelchair_accessible` int(11) DEFAULT NULL,
  `bikes_allowed` varchar(255) DEFAULT NULL,
  KEY `trip_short_name_index` (`trip_short_name`),
  KEY `trip_headsign_index` (`trip_headsign`),
  KEY `realtime_trip_id_index` (`realtime_trip_id`),
  KEY `shape_id_index` (`shape_id`),
  KEY `trip_id_index` (`trip_id`),
  KEY `service_id_index` (`service_id`),
  KEY `route_id_index` (`route_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Dump of table user
# ------------------------------------------------------------

DROP TABLE IF EXISTS `user`;

CREATE TABLE `user` (
  `user_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Dump of table user_location
# ------------------------------------------------------------

DROP TABLE IF EXISTS `user_location`;

CREATE TABLE `user_location` (
  `user_location_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `datetime` int(45) DEFAULT NULL,
  `lon` varchar(45) DEFAULT NULL,
  `lat` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`user_location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Dump of table user_vehicle_match
# ------------------------------------------------------------

DROP TABLE IF EXISTS `user_vehicle_match`;

CREATE TABLE `user_vehicle_match` (
  `user_vehicle_match_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `inserted_at` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `bearing` float DEFAULT NULL,
  `current_neighbor_coords` varchar(255) DEFAULT NULL,
  `current_neighbor_datetime` int(11) DEFAULT NULL,
  `current_user_coords` varchar(255) DEFAULT NULL,
  `next_neighbor_coords` varchar(255) DEFAULT NULL,
  `next_neighbor_datetime` int(11) DEFAULT NULL,
  `prev_neighbor_coords` varchar(255) DEFAULT NULL,
  `prev_neighbor_datetime` int(11) DEFAULT NULL,
  `speed` float DEFAULT NULL,
  `vehicle_id` varchar(255) DEFAULT NULL,
  `vehicle_type` varchar(45) DEFAULT NULL,
  `vehicle_travel_distance` float DEFAULT NULL,
  `user_travel_distance` float DEFAULT NULL,
  `user_vehicle_distance` float DEFAULT NULL,
  `emission_prob` float DEFAULT NULL,
  `closest_stop_id` int(11) DEFAULT NULL,
  `closest_stop_distance` float DEFAULT NULL,
  `transition_matrix` text,
  PRIMARY KEY (`user_vehicle_match_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Dump of table vehicle
# ------------------------------------------------------------

DROP TABLE IF EXISTS `vehicle`;

CREATE TABLE `vehicle` (
  `vehicle_id` int(11) NOT NULL AUTO_INCREMENT,
  `info` text,
  `identifier` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`vehicle_id`),
  KEY `vehicle_id_index` (`vehicle_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Dump of table vehicle_location
# ------------------------------------------------------------

DROP TABLE IF EXISTS `vehicle_location`;

CREATE TABLE `vehicle_location` (
  `vehicle_location_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `timestamp` int(45) DEFAULT NULL,
  `speed` int(11) DEFAULT NULL,
  `x` int(11) DEFAULT NULL,
  `y` int(11) DEFAULT NULL,
  `z` int(11) DEFAULT NULL,
  `vehicle_id` int(11) DEFAULT NULL,
  `orientation` int(11) DEFAULT NULL,
  PRIMARY KEY (`vehicle_location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;




/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
