DROP TABLE IF EXISTS "public"."trajectories";
DROP TABLE IF EXISTS "public"."temp_shapes";
DROP TABLE IF EXISTS "public"."stop_times";
DROP TABLE IF EXISTS "public"."trips";
DROP TABLE IF EXISTS "public"."stops";
DROP TABLE IF EXISTS "public"."calendar_dates";

CREATE TABLE "public"."temp_shapes" (
  "shape_id" int8 NOT NULL, 
  "shape_pt_sequence" int4 NOT NULL, 
  "shape_pt_lat" float NOT NULL,
  "shape_pt_lon" float NOT NULL,
  "shape_dist_traveled" int4 NULL, 
  "geom" geography(POINT,4326)
);

CREATE TABLE "public"."trajectories" (
	"trajectory_id" SERIAL PRIMARY KEY,
  "shape_id" int8 NOT NULL,
  "content" text COLLATE "default", 
  "geom" geography(LINESTRING,4326)
)
WITH (OIDS=FALSE);
ALTER TABLE "public"."trajectories" OWNER TO "docker";

CREATE TABLE "public"."stop_times" (
	"trip_id" int8 NOT NULL,
	"stop_sequence" int4,
	"stop_id" varchar(255) COLLATE "default",
	"stop_headsign" varchar(255) COLLATE "default",
	"arrival_time" varchar(255) COLLATE "default",
	"departure_time" varchar(255) COLLATE "default",
	"pickup_type" int4,
	"drop_off_type" int4,
	"timepoint" int8,
	"shape_dist_traveled" int4 NULL,
	"fare_units_traveled" int8
)
WITH (OIDS=FALSE);
ALTER TABLE "public"."stop_times" OWNER TO "docker";

CREATE TABLE "public"."trips" (
	"route_id" int8,
	"service_id" int8,
	"trip_id" int8,
	"realtime_trip_id" varchar(255) COLLATE "default",
	"trip_headsign" varchar(255) COLLATE "default",
	"trip_short_name" int8,
	"trip_long_name" varchar(255) COLLATE "default",
	"direction" int4,
	"block_id" varchar(255) COLLATE "default",
	"shape_id" int8,
	"wheelchair_accessible" int2,
	"bikes_allowed" int2
)
WITH (OIDS=FALSE);
ALTER TABLE "public"."trips" OWNER TO "docker";

CREATE TABLE "public"."stops" (
	"stop_id" varchar(255) COLLATE "default",
	"stop_code" varchar(255) COLLATE "default",
	"stop_name" varchar(255) COLLATE "default",
	"stop_lat" float8,
	"stop_lon" float8,
	"location_type" int4,
	"parent_station" varchar(255) COLLATE "default",
	"stop_timezone" varchar(255) COLLATE "default",
	"wheelchair_boarding" varchar(255) COLLATE "default",
	"platform_code" varchar(255) COLLATE "default",
	"zone_id" varchar(255) COLLATE "default"
)
WITH (OIDS=FALSE);
ALTER TABLE "public"."stops" OWNER TO "docker";

CREATE TABLE "public"."calendar_dates" (
	"service_id" int2 NOT NULL,
	"date" int4 NOT NULL,
	"exception_type" int2
)
WITH (OIDS=FALSE);
ALTER TABLE "public"."calendar_dates" OWNER TO "docker";

-- ----------------------------
--  Primary key structure for table trajectories
-- ----------------------------
-- ALTER TABLE "public"."trajectories" ADD SERIAL PRIMARY KEY ("trajectory_id") NOT DEFERRABLE INITIALLY IMMEDIATE;