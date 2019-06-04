DROP TABLE IF EXISTS "public"."trajectories";
DROP TABLE IF EXISTS "public"."temp_shapes";

CREATE TABLE "public"."temp_shapes" (
  "shape_id" int8 NOT NULL, 
  "shape_pt_sequence" int4 NOT NULL, 
  "shape_pt_lat" float NOT NULL,
  "shape_pt_lon" float NOT NULL,
  "shape_dist_traveled" int8 NULL, 
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

-- ----------------------------
--  Primary key structure for table trajectories
-- ----------------------------
-- ALTER TABLE "public"."trajectories" ADD SERIAL PRIMARY KEY ("trajectory_id") NOT DEFERRABLE INITIALLY IMMEDIATE;