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

redis_client = redis.StrictRedis(host=cfg.redis['host'], port=cfg.redis['port'], db=cfg.redis['db'], decode_responses=cfg.redis['decode_responses'])
redis_layer_store = redis.StrictRedis(host=cfg.redis['host'], port=cfg.redis['port'], db=cfg.redis['layer_db'], decode_responses=cfg.redis['decode_responses'])

def georadius(lon, lat, radius): 
  return redis_client.georadius('items', lon, lat, radius, 'm', 'WITHDIST', 'WITHCOORD', 'COUNT', 50)


def get(itemKey): 
  return redis_client.get(itemKey) 


def get_vehicles_by_radius(lon, lat, radius, user_datetime): 
  datapoints = georadius(lon, lat, radius) 
  datapoints_df = pd.DataFrame(columns=['vehicle_id'])

  for datapoint in datapoints: 
    vehicle, datetime = datapoint[0].rsplit(':', 1)
    vehicle_type, vehicle_id = vehicle.split(':', 1)

    vehicle_info = get(datapoint[0])

    if vehicle_info: 
      vehicle_info = json.loads(vehicle_info) 

      if datetime == 'latest': 
        datetime = int(vehicle_info['datetimeUnix'])
      else: 
        datetime = int(datetime) 

      if 'vehiclePrevPoint' not in vehicle_info: 
        vehicle_prev_point = False
      else: 
        vehicle_prev_point = vehicle_info['vehiclePrevPoint']
    
    if datetime and datetime <= user_datetime + 30 and datetime >= user_datetime - 120: 
      coordinates = datapoint[3]

      datapoints_df = datapoints_df.append({
        'vehicle_id': vehicle_id, 
        'vehicle_type': vehicle_type, 
        'vehicle_datetime': datetime, 
        'coordinates': [coordinates[0], coordinates[1]], 
        'time_distance': math.sqrt((datetime - user_datetime)**2), # Basic Manhattan distance
        'historic': True if datetime - user_datetime < 0 else False, 
        'vehicle_prev_point': vehicle_prev_point
      }, ignore_index=True)

  vehicles_df = pd.DataFrame()
  for vehicle_id in datapoints_df['vehicle_id'].unique(): 
    vehicle_type = datapoints_df[datapoints_df['vehicle_id'] == vehicle_id]['vehicle_type'].iloc[0]

    vehicle_datapoints = datapoints_df[(datapoints_df['vehicle_id'] == vehicle_id)].sort_values(by='time_distance', ascending=True)
  
    # In case only one datapoint falls within the search radius, populate the vehicle with the prev data point to make a line. 
    if len(vehicle_datapoints) < 2 and vehicle_datapoints['vehicle_prev_point'].iloc[0]: 
      prev_vehicle_datapoint = get(vehicle_datapoints['vehicle_prev_point'].iloc[0])

      if prev_vehicle_datapoint: 
        prev_vehicle_datapoint = json.loads(prev_vehicle_datapoint)

        vehicle_datapoints = vehicle_datapoints.append({
          'vehicle_id': vehicle_id, 
          'vehicle_type': vehicle_type, 
          'vehicle_datetime': int(prev_vehicle_datapoint['datetimeUnix']), 
          'coordinates': [prev_vehicle_datapoint['longitude'], prev_vehicle_datapoint['latitude']],
          'time_distance': math.sqrt((int(prev_vehicle_datapoint['datetimeUnix']) - user_datetime)**2)
        }, ignore_index=True)

    
    if len(vehicle_datapoints) >= 2: 
      if vehicle_datapoints['vehicle_datetime'].iloc[0] > vehicle_datapoints['vehicle_datetime'].iloc[1]: 
        start_path_datetime = vehicle_datapoints['vehicle_datetime'].iloc[1]
        start_path_coordinates = vehicle_datapoints['coordinates'].iloc[1]
        end_path_datetime = vehicle_datapoints['vehicle_datetime'].iloc[0]
        end_path_coordinates = vehicle_datapoints['coordinates'].iloc[0]
      elif vehicle_datapoints['vehicle_datetime'].iloc[0] < vehicle_datapoints['vehicle_datetime'].iloc[1]: 
        start_path_datetime = vehicle_datapoints['vehicle_datetime'].iloc[0]
        start_path_coordinates = vehicle_datapoints['coordinates'].iloc[0]
        end_path_datetime = vehicle_datapoints['vehicle_datetime'].iloc[1]
        end_path_coordinates = vehicle_datapoints['coordinates'].iloc[1]
      else: 
        print('uncanny situation??')
      
      bearing = transportgeo.bearing(end_path_coordinates, start_path_coordinates)
      speed = transportgeo.speed(
        end_path_coordinates, 
        start_path_coordinates, 
        end_path_datetime, 
        start_path_datetime
      )

      extrapolated_distance = math.sqrt((speed * (user_datetime - start_path_datetime))**2)
      current_path_coordinates = transportgeo.destination(start_path_coordinates, bearing, extrapolated_distance)

      vehicles_df = vehicles_df.append({
        'vehicle_id': vehicle_id, 
        'vehicle_type': vehicle_type,
        'start_path_coordinates': start_path_coordinates, 
        'start_path_datetime': start_path_datetime, 
        'current_path_coordinates': current_path_coordinates, 
        'current_path_datetime': user_datetime, 
        'end_path_coordinates': end_path_coordinates, 
        'end_path_datetime': end_path_datetime, 
        'bearing': bearing, 
        'speed': speed, 
        'current_user_coords': [lon, lat], 
        'inserted_at': int(time.time()) 
      }, ignore_index=True)
    

  return vehicles_df

def get_observations(user_id, datetime): 

  # Get observations from Redis
  df = pd.DataFrame() 
  observations = False 

  try:

    observations = redis_layer_store.get(user_id)

    if observations: 
      json_data = json.loads(observations)

      for row in json_data: 
        df = df.append(row, ignore_index=True)
    
  except Exception as e:
    print('execption: ' + str(e))
    capture_exception(e)
  finally:

    if not df.empty: 
      return df
    else: 
      return ()