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

    # prev_neighbors = datapoints_df[(datapoints_df['vehicle_id'] == vehicle_id) & (datapoints_df['historic'] == True)].sort_values(by='time_distance', ascending=True)
    # next_neighbors = datapoints_df[(datapoints_df['vehicle_id'] == vehicle_id) & (datapoints_df['historic'] == False)].sort_values(by='time_distance', ascending=True)
    # print('prev neighbor: ' + str(prev_neighbors) + ' next: ' + str(next_neighbors))

    # if ( (prev_neighbors.empty and len(next_neighbors.index) <= 2) or (next_neighbors.empty and len(prev_neighbors.index) <= 2) or (len(prev_neighbors) <= 1 and len(next_neighbors) <= 1) ): 
    #   # The minimum amount of datapoints to work with is 2.

    #   if prev_neighbors.empty: 
        
    #     prev_neighbor_coords = next_neighbors['coordinates'].iloc[1]
    #     prev_neighbor_datetime = next_neighbors['vehicle_datetime'].iloc[1]

    #     next_neighbor_coords = next_neighbors['coordinates'].iloc[0]
    #     next_neighbor_datetime = next_neighbors['vehicle_datetime'].iloc[0]

    #     bearing = transportgeo.bearing(next_neighbor_coords, prev_neighbor_coords)
    #     speed = transportgeo.speed(
    #       next_neighbor_coords, 
    #       prev_neighbor_coords, 
    #       next_neighbor_datetime, 
    #       prev_neighbor_datetime
    #     )
    #     neighbor_extrapolated_distance = math.sqrt((speed * (user_datetime - prev_neighbor_datetime))**2)
    #     current_neighbor_coords = transportgeo.destination(prev_neighbor_coords, bearing, neighbor_extrapolated_distance)

    #   elif next_neighbors.empty: 
    #     # Backpropagate further into the history

    #     prev_neighbor_coords = prev_neighbors['coordinates'].iloc[0]
    #     prev_neighbor_datetime = prev_neighbors['vehicle_datetime'].iloc[0]

    #     next_neighbor_coords = prev_neighbors['coordinates'].iloc[1]
    #     next_neighbor_datetime = prev_neighbors['vehicle_datetime'].iloc[1]

    #     bearing = transportgeo.bearing(prev_neighbor_coords, next_neighbor_coords)
    #     speed = transportgeo.speed(
    #       prev_neighbor_coords, 
    #       next_neighbor_coords,
    #       prev_neighbor_datetime,
    #       next_neighbor_datetime
    #     )
    #     neighbor_extrapolated_distance = math.sqrt((speed * (user_datetime - prev_neighbors['vehicle_datetime'].iloc[0]))**2)
    #     current_neighbor_coords = transportgeo.destination(prev_neighbors['coordinates'].iloc[0], bearing, neighbor_extrapolated_distance)

    #   else: 
    #     prev_neighbor_coords = prev_neighbors['coordinates'].iloc[0]
    #     prev_neighbor_datetime = prev_neighbors['vehicle_datetime'].iloc[0]

    #     next_neighbor_coords = next_neighbors['coordinates'].iloc[0]
    #     next_neighbor_datetime = next_neighbors['vehicle_datetime'].iloc[0]

    #     bearing = transportgeo.bearing(prev_neighbor_coords, next_neighbor_coords)
    #     speed = transportgeo.speed(
    #       prev_neighbor_coords, 
    #       next_neighbor_coords, 
    #       prev_neighbor_datetime, 
    #       next_neighbor_datetime
    #     )
    #     neighbor_extrapolated_distance = math.sqrt((speed * (user_datetime - prev_neighbor_datetime))**2)
    #     current_neighbor_coords = transportgeo.destination(prev_neighbor_coords, bearing, neighbor_extrapolated_distance)

    #   vehicles_df = vehicles_df.append({
    #     'vehicle_id': vehicle_id, 
    #     'vehicle_type': vehicle_type,
    #     'prev_neighbor_coords': prev_neighbor_coords, 
    #     'prev_neighbor_datetime': prev_neighbor_datetime, 
    #     'current_neighbor_coords': current_neighbor_coords, 
    #     'current_neighbor_datetime': user_datetime, 
    #     'next_neighbor_coords': next_neighbor_coords, 
    #     'next_neighbor_datetime': next_neighbor_datetime, 
    #     'bearing': bearing, 
    #     'speed': speed, 
    #     'current_user_coords': [lon, lat], 
    #     'inserted_at': int(time.time()) 
    #   }, ignore_index=True)

def get_observations(user_id, datetime): 

  # Get observations from Redis

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