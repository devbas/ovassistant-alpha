#!/usr/bin/env python3

import redis 
import config as cfg 
import pandas as pd 
import numpy as np 
import transportgeo
import math
# import pymysql.cursors
import mysql.connector
import time
from sentry_sdk import capture_exception
import json

# db = pymysql.connect(host=cfg.mysql['host'], port=cfg.mysql['port'], db=cfg.mysql['db'], user=cfg.mysql['user'], password=cfg.mysql['password'], cursorclass=pymysql.cursors.DictCursor)
redis_client = redis.StrictRedis(host=cfg.redis['host'], port=cfg.redis['port'], db=cfg.redis['db'], decode_responses=cfg.redis['decode_responses'])

def georadius(lon, lat, radius): 
  return redis_client.georadius('items', lon, lat, radius, 'm', 'WITHDIST', 'WITHCOORD')


def get(itemKey): 
  return redis_client.get(itemKey) 


def get_vehicles_by_radius(lon, lat, radius, user_datetime): 
  datapoints = georadius(lon, lat, radius) 
  datapoints_df = pd.DataFrame(columns=['vehicle_id'])

  for datapoint in datapoints: 
    vehicle, datetime = datapoint[0].rsplit(':', 1)
    vehicle_type, vehicle_id = vehicle.split(':', 1)

    if datetime == 'latest':
      vehicle_info = get(datapoint[0])
      if vehicle_info:
        vehicle_info = json.loads(vehicle_info)
        datetime = int(vehicle_info['datetimeUnix'])
      else: 
        datetime = False
    else: 
      datetime = int(datetime)
    
    if datetime and datetime <= user_datetime + 120 and datetime >= user_datetime - 120: 
      datapoints_df = datapoints_df.append({
        'vehicle_id': vehicle_id, 
        'vehicle_type': vehicle_type, 
        'vehicle_datetime': datetime, 
        'coordinates': list([datapoint[2][0], datapoint[2][1]]), 
        'time_distance': math.sqrt((datetime - user_datetime)**2), # Basic Manhattan distance
        'historic': True if datetime - user_datetime < 0 else False 
      }, ignore_index=True)

  vehicles_df = pd.DataFrame()
  for vehicle_id in datapoints_df['vehicle_id'].unique(): 
    
    vehicle_type = datapoints_df[datapoints_df['vehicle_id'] == vehicle_id]['vehicle_type'].iloc[0]
    
    prev_neighbors = datapoints_df[(datapoints_df['vehicle_id'] == vehicle_id) & (datapoints_df['historic'] == True)].sort_values(by='time_distance', ascending=True)
    next_neighbors = datapoints_df[(datapoints_df['vehicle_id'] == vehicle_id) & (datapoints_df['historic'] == False)].sort_values(by='time_distance', ascending=True)
    
    if not (prev_neighbors.empty and len(next_neighbors.index) < 2) and not (next_neighbors.empty and len(prev_neighbors.index) < 2): 
      #   # The minimum amount of datapoints to work with is 2.

      if prev_neighbors.empty: 
        
        prev_neighbor_coords = next_neighbors['coordinates'].iloc[1]
        prev_neighbor_datetime = next_neighbors['vehicle_datetime'].iloc[1]

        next_neighbor_coords = next_neighbors['coordinates'].iloc[0]
        next_neighbor_datetime = next_neighbors['vehicle_datetime'].iloc[0]
        # print('prev coords: ' + str(prev_neighbor_coords) + ' next coords: ' + str(next_neighbor_coords))
        bearing = transportgeo.bearing(next_neighbor_coords, prev_neighbor_coords)
        speed = transportgeo.speed(
          next_neighbor_coords, 
          prev_neighbor_coords, 
          next_neighbor_datetime, 
          prev_neighbor_datetime
        )
        neighbor_extrapolated_distance = math.sqrt((speed * (user_datetime - prev_neighbor_datetime))**2)
        current_neighbor_coords = transportgeo.destination(prev_neighbor_coords, bearing, neighbor_extrapolated_distance)
        # print('1current_neighbor_coords: ' + str(current_neighbor_coords) + ' and prev neighbor coords: ' + str(prev_neighbor_coords) + ' with a distance of: ' + str(neighbor_extrapolated_distance))
      elif next_neighbors.empty: 
        # Backpropagate further into the history

        prev_neighbor_coords = prev_neighbors['coordinates'].iloc[0]
        prev_neighbor_datetime = prev_neighbors['vehicle_datetime'].iloc[0]

        next_neighbor_coords = prev_neighbors['coordinates'].iloc[1]
        next_neighbor_datetime = prev_neighbors['vehicle_datetime'].iloc[1]
        # print('prev coords: ' + str(prev_neighbor_coords) + ' next coords: ' + str(next_neighbor_coords))
        bearing = transportgeo.bearing(prev_neighbor_coords, next_neighbor_coords)
        speed = transportgeo.speed(
          prev_neighbor_coords, 
          next_neighbor_coords,
          prev_neighbor_datetime,
          next_neighbor_datetime
        )
        neighbor_extrapolated_distance = math.sqrt((speed * (user_datetime - prev_neighbors['vehicle_datetime'].iloc[0]))**2)
        current_neighbor_coords = transportgeo.destination(prev_neighbors['coordinates'].iloc[0], bearing, neighbor_extrapolated_distance)
        # print('2current_neighbor_coords: ' + str(current_neighbor_coords) + ' and prev neighbor coords: ' + str(prev_neighbor_coords) + ' with a distance of: ' + str(neighbor_extrapolated_distance))
      else: 
        prev_neighbor_coords = prev_neighbors['coordinates'].iloc[0]
        prev_neighbor_datetime = prev_neighbors['vehicle_datetime'].iloc[0]

        next_neighbor_coords = next_neighbors['coordinates'].iloc[0]
        next_neighbor_datetime = next_neighbors['vehicle_datetime'].iloc[0]
        # print('prev coords: ' + str(prev_neighbor_coords) + ' next coords: ' + str(next_neighbor_coords))
        bearing = transportgeo.bearing(prev_neighbor_coords, next_neighbor_coords)
        speed = transportgeo.speed(
          prev_neighbor_coords, 
          next_neighbor_coords, 
          prev_neighbor_datetime, 
          next_neighbor_datetime
        )
        neighbor_extrapolated_distance = math.sqrt((speed * (user_datetime - prev_neighbor_datetime))**2)
        current_neighbor_coords = transportgeo.destination(prev_neighbor_coords, bearing, neighbor_extrapolated_distance)
        # print('3current_neighbor_coords: ' + str(current_neighbor_coords) + ' and prev neighbor coords: ' + str(prev_neighbor_coords) + ' with a distance of: ' + str(neighbor_extrapolated_distance) + ' a speed of: ' + str(speed))
      vehicles_df = vehicles_df.append({
        'vehicle_id': vehicle_id, 
        'vehicle_type': vehicle_type,
        'prev_neighbor_coords': prev_neighbor_coords, 
        'prev_neighbor_datetime': prev_neighbor_datetime, 
        'current_neighbor_coords': current_neighbor_coords, 
        'current_neighbor_datetime': user_datetime, 
        'next_neighbor_coords': next_neighbor_coords, 
        'next_neighbor_datetime': next_neighbor_datetime, 
        'bearing': bearing, 
        'speed': speed, 
        'current_user_coords': [lon, lat], 
        'inserted_at': int(time.time()) 
      }, ignore_index=True)
  
  return vehicles_df

def get_observations(user_id, datetime): 

  observations = False 
  try:

    db = mysql.connector.connect(
      host=cfg.mysql['host'],
      user=cfg.mysql['user'],
      passwd=cfg.mysql['password'], 
      database=cfg.mysql['db'], 
      raise_on_warnings=True
    )

    print('user_id and datetime: ' + str(user_id)  + ' ' + str(int(datetime) - 60))
    cursor = db.cursor(dictionary=True,buffered=True) 

    # with db.cursor() as cursor: 
    cursor.execute('SELECT * FROM user_vehicle_match WHERE user_id = %s AND current_neighbor_datetime > %s', (user_id, int(datetime) - 120))
    # cursor.execute('SELECT * FROM user_vehicle_match WHERE user_id = %s', (user_id))
    observations = cursor.fetchall()
    print('query: ' + str(cursor.statement))
    db.close()
    
  except Exception as e:
    capture_exception(e)
  finally:

    if observations: 
      return observations
    else: 
      return ()