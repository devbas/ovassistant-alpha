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

CREATE INDEX idx_temp_shapes_shape_id
ON temp_shapes(shape_id);

CREATE TABLE "public"."trajectories" (
	"trajectory_id" SERIAL PRIMARY KEY,
  "geom" geometry(LINESTRINGM,4326), 
	"trip_id" int4 NOT NULL, 
	"start_planned" int4 NULL, 
	"end_planned" int4 NULL, 
	"vehicle_id" varchar(64) COLLATE "default"
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

CREATE INDEX idx_stoptimes_trip_id
ON stop_times(trip_id);

CREATE INDEX idx_stoptimes_stop_id
ON stop_times(stop_id); 

CREATE TABLE "public"."trips" (
	"route_id" int8,
	"service_id" int8,
	"trip_id" int8,
	"realtime_trip_id" varchar(255) COLLATE "default",
	"trip_headsign" varchar(255) COLLATE "default",
	"trip_short_name" int8,
	"trip_long_name" varchar(255) COLLATE "default",
	"direction_id" int4,
	"block_id" varchar(255) COLLATE "default",
	"shape_id" int8,
	"wheelchair_accessible" int2,
	"bikes_allowed" int2
)
WITH (OIDS=FALSE);
ALTER TABLE "public"."trips" OWNER TO "docker";

CREATE INDEX idx_trips_trip_id
ON trips(trip_id);

CREATE INDEX idx_trips_realtime_trip_id
ON trips(realtime_trip_id);

CREATE INDEX idx_trips_trip_short_name
ON trips(trip_short_name);

CREATE INDEX idx_trips_service_id
ON trips(service_id);

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
	"zone_id" varchar(255) COLLATE "default", 
	"geom" geography(POINT,4326)
)
WITH (OIDS=FALSE);
ALTER TABLE "public"."stops" OWNER TO "docker";

CREATE INDEX idx_stops_stop_id
ON stops(stop_id);

CREATE TABLE "public"."calendar_dates" (
	"service_id" int2 NOT NULL,
	"date" int4 NOT NULL,
	"exception_type" int2
)
WITH (OIDS=FALSE);
ALTER TABLE "public"."calendar_dates" OWNER TO "docker";

CREATE TABLE "public"."routes" (
	"route_id" int4 NOT NULL, 
	"agency_id" varchar(255) COLLATE "default", 
	"route_short_name" varchar(255) COLLATE "default",
	"route_long_name" varchar(255) COLLATE "default", 
	"route_desc" varchar(255) COLLATE "default", 
	"route_type" int4, 
	"route_color" varchar(255) COLLATE "default", 
	"route_text_color" varchar(255) COLLATE "default", 
	"route_url" varchar(255) COLLATE "default"
)
WITH (OIDS=FALSE);
ALTER TABLE "public"."routes" OWNER TO "docker";

CREATE INDEX idx_routes_route_id
ON routes(route_id);

-- ----------------------------
--  Primary key structure for table trajectories
-- ----------------------------
-- ALTER TABLE "public"."trajectories" ADD SERIAL PRIMARY KEY ("trajectory_id") NOT DEFERRABLE INITIALLY IMMEDIATE;

-- CREATE EVERY TABLE TWICE, SINCE WE SWAP IN/OUT A NEW ROUTE SCHEDULE EVERY NIGHT 
CREATE TABLE "public"."tmp_temp_shapes" (
  "shape_id" int8 NOT NULL, 
  "shape_pt_sequence" int4 NOT NULL, 
  "shape_pt_lat" float NOT NULL,
  "shape_pt_lon" float NOT NULL,
  "shape_dist_traveled" int4 NULL, 
  "geom" geography(POINT,4326)
)
WITH (OIDS=FALSE);
ALTER TABLE "public"."tmp_temp_shapes" OWNER TO "docker";

CREATE INDEX idx_tmp_temp_shapes_shape_id
ON tmp_temp_shapes(shape_id);

CREATE TABLE "public"."tmp_trajectories" (
	"trajectory_id" SERIAL PRIMARY KEY,
  "geom" geometry(LINESTRINGM,4326), 
	"trip_id" int4 NOT NULL, 
	"start_planned" int4 NULL, 
	"end_planned" int4 NULL, 
	"vehicle_id" varchar(64) COLLATE "default"
)
WITH (OIDS=FALSE);
ALTER TABLE "public"."tmp_trajectories" OWNER TO "docker";

CREATE TABLE "public"."tmp_stop_times" (
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
ALTER TABLE "public"."tmp_stop_times" OWNER TO "docker";

CREATE INDEX idx_tmp_stoptimes_trip_id
ON tmp_stop_times(trip_id);

CREATE INDEX idx_tmp_stoptimes_stop_id
ON tmp_stop_times(stop_id); 

CREATE TABLE "public"."tmp_trips" (
	"route_id" int8,
	"service_id" int8,
	"trip_id" int8,
	"realtime_trip_id" varchar(255) COLLATE "default",
	"trip_headsign" varchar(255) COLLATE "default",
	"trip_short_name" int8,
	"trip_long_name" varchar(255) COLLATE "default",
	"direction_id" int4,
	"block_id" varchar(255) COLLATE "default",
	"shape_id" int8,
	"wheelchair_accessible" int2,
	"bikes_allowed" int2
)
WITH (OIDS=FALSE);
ALTER TABLE "public"."tmp_trips" OWNER TO "docker";

CREATE INDEX idx_tmp_trips_trip_id
ON tmp_trips(trip_id);

CREATE INDEX idx_tmp_trips_realtime_trip_id
ON tmp_trips(realtime_trip_id);

CREATE INDEX idx_tmp_trips_trip_short_name
ON tmp_trips(trip_short_name);

CREATE INDEX idx_tmp_trips_service_id
ON tmp_trips(service_id);

CREATE TABLE "public"."tmp_stops" (
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
	"zone_id" varchar(255) COLLATE "default", 
	"geom" geography(POINT,4326)
)
WITH (OIDS=FALSE);
ALTER TABLE "public"."tmp_stops" OWNER TO "docker";

CREATE INDEX idx_tmp_stops_stop_id
ON tmp_stops(stop_id);

CREATE TABLE "public"."tmp_calendar_dates" (
	"service_id" int2 NOT NULL,
	"date" int4 NOT NULL,
	"exception_type" int2
)
WITH (OIDS=FALSE);
ALTER TABLE "public"."tmp_calendar_dates" OWNER TO "docker";

CREATE TABLE "public"."tmp_routes" (
	"route_id" int4 NOT NULL, 
	"agency_id" varchar(255) COLLATE "default", 
	"route_short_name" varchar(255) COLLATE "default",
	"route_long_name" varchar(255) COLLATE "default", 
	"route_desc" varchar(255) COLLATE "default", 
	"route_type" int4, 
	"route_color" varchar(255) COLLATE "default", 
	"route_text_color" varchar(255) COLLATE "default", 
	"route_url" varchar(255) COLLATE "default"
)
WITH (OIDS=FALSE);
ALTER TABLE "public"."tmp_routes" OWNER TO "docker";

CREATE INDEX idx_tmp_routes_route_id
ON tmp_routes(route_id);