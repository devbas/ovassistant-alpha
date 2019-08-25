#!/usr/bin/env python3

import redis 
import config as cfg 
import pandas as pd 
import numpy as np 
import transportgeo
import math
import time
from sentry_sdk import capture_exception
import json
import psycopg2
from psycopg2 import pool

redis_user_location_history = redis.StrictRedis(host=cfg.redis['host'], port=cfg.redis['port'], db=cfg.redis['layer_db'], decode_responses=cfg.redis['decode_responses'])

try:
  postgres_pool = psycopg2.pool.SimpleConnectionPool(1,20, host=cfg.psql['host'], port=5432, database=cfg.psql['db'], user=cfg.psql['user'], password=cfg.psql['password'])

  if(postgres_pool): 
    print('Postgres Connection pool created successfully')

except (Exception, psycopg2.DatabaseError) as error :
  print ("Error while connecting to PostgreSQL", error)

finally:
  if (postgres_pool):
    postgres_pool.closeall
  
  print("PostgreSQL connection pool is closed")

def get_vehicle_location_state_by_time(lon, lat, user_datetime): 

  # 0.002690 = 200 meter
  query = "SELECT trip_id, vehicle_id, \
	          ST_Distance_Sphere('SRID=4326;POINT({} {})', ST_LocateAlong(geom, {})) AS user_vehicle_distance \
          FROM trajectories \
          WHERE start_planned <= {} \
          AND end_planned >= {} \
          AND ST_DWithin(ST_LocateAlong(geom, {}), 'SRID=4326;POINT({} {})', 0.002690) \
          ORDER BY user_vehicle_distance ASC ".format(lon, lat, user_datetime, user_datetime, user_datetime, user_datetime, lon, lat)
  
  # print('query: ', query)

  try: 
    conn = postgres_pool.getconn()
    data = pd.read_sql(query, conn) 
  except (Exception, psycopg2.DatabaseError) as error:
    print ("Error while connecting to PostgreSQL", error)
  finally: 
    postgres_pool.putconn(conn)

  if not data.empty: 
    # print('result: ', str([get_vehicle_nearest_stop(trip_id, lat, lon) for trip_id in data['trip_id']]))
    data['nearest_stop_distance'], data['nearest_stop_id'] = zip(*[get_vehicle_nearest_stop(trip_id, lat, lon) for trip_id in data['trip_id']])

  data['device_datetime'] = user_datetime
  data['device_lat'] = lat 
  data['device_lon'] = lon

  # print('shape: ', str(data.shape))

  return data 

def get_vehicle_nearest_stop(trip_id, lat, lon): 

  query = "SELECT MIN(ST_Distance_Sphere('SRID=4326;POINT({} {})', geom)) as nearest_stop_distance, stop_id as nearest_stop_id \
            FROM stop_times \
            WHERE trip_id = {} \
            GROUP BY stop_id \
            ORDER BY nearest_stop_distance ASC \
            LIMIT 1".format(lon, lat, trip_id)
  
  try: 
    conn = postgres_pool.getconn()
    result = pd.read_sql(query, conn) 
  except (Exception, psycopg2.DatabaseError) as error:
    print ("Error while connecting to PostgreSQL", error)
  finally: 
    postgres_pool.putconn(conn)

  return (result['nearest_stop_distance'][0], result['nearest_stop_id'][0])


def get_observations(user_id, datetime): 

  # Get recent observations from Redis
  df = pd.DataFrame()
  observations = False 

  try:
    observations = redis_user_location_history.get(user_id)

    if observations is not None: 
      json_data = json.loads(observations)
      print('json data: ', str(json_data))
      if json_data:
        for row in json_data: 
          df = df.append(row, ignore_index=True)
    
  except Exception as e:
    print('execption: ' + str(e))
    capture_exception(e)
  finally:
    return df