import math
import numpy as np
import locationcache
import shapestore
import config as cfg 
import mysql.connector
from mysql.connector import errorcode
import nvector as nv
import json
from sentry_sdk import capture_exception
import time


# db = pymysql.connect(host=cfg.mysql['host'], port=cfg.mysql['port'], db=cfg.mysql['db'], user=cfg.mysql['user'], password=cfg.mysql['password'], cursorclass=pymysql.cursors.DictCursor)

def bearing(a, b): 
  """
    Calculates the bearing between two points.
    The formulae used is the following:
        θ = atan2(sin(Δlong).cos(lat2),
                  cos(lat1).sin(lat2) − sin(lat1).cos(lat2).cos(Δlong))
    :Parameters:
      - `start_point: The tuple representing the latitude/longitude for the
        first point. Latitude and longitude must be in decimal degrees
      - `end_point: The tuple representing the latitude/longitude for the
        second point. Latitude and longitude must be in decimal degrees
    :Returns:
      The bearing in degrees
    :Returns Type:
      float
  """

  lat1 = math.radians(a[1])
  lat2 = math.radians(b[1])

  diffLong = math.radians(b[0] - a[0])

  x = math.sin(diffLong) * math.cos(lat2)
  y = math.cos(lat1) * math.sin(lat2) - (math.sin(lat1)
          * math.cos(lat2) * math.cos(diffLong))

  initial_bearing = math.atan2(x, y)

  # Now we have the initial bearing but math.atan2 return values
  # from -180° to + 180° which is not what we want for a compass bearing
  # The solution is to normalize the initial bearing as shown below
  initial_bearing = math.degrees(initial_bearing)
  compass_bearing = (initial_bearing + 360) % 360

  return compass_bearing

# Following the Haversine formula, calculate the speed per second for start_point with start_datetime and end_point with end_datetime. 
# Haversine formula: https://en.wikipedia.org/wiki/Haversine_formula
def speed(a, b, a_time, b_time): 
  """
    Calculates the speed between two points. 
    The formulae used is the following: 

    :Parameters: 
      - `start_point: The tuple representing the latitude/longitude for the
        first point. Latitude and longitude must be in decimal degrees
      - `end_point: The tuple representing the latitude/longitude for the 
        second point. Latitude and longitude must be in decimal degrees
      - `start_datetime: The integer representing the corresponding UNIX
        datetime for given start_point. 
      - `end_datetime: The integer representing the corresponding UNIX 
        datetime for the given end_point. 
    :Returns: 
      The speed per second in meters
    :ReturnType: 
      float
  """

  lon1, lat1, lon2, lat2 = map(math.radians, [a[0], a[1], b[0], b[1]])

  # haversine formula 
  dlon = lon2 - lon1 
  dlat = lat2 - lat1 
  a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
  c = 2 * math.asin(math.sqrt(a)) 
  R = 6378100 # Radius of earth in kilometers. Use 3956 for miles
  dist = (c * R)
  
  time_diff = math.sqrt(np.power((a_time - b_time), 2))
  speed_second = dist / (time_diff if time_diff > 0 else 1)
  return speed_second

def destination(coords, brng, d): 
  R = 6378100 #Radius of the Earth
  brng = math.radians(brng) #Bearing is degrees converted to radians.

  lat1 = math.radians(coords[1])
  lon1 = math.radians(coords[0])

  lat2 = math.asin( math.sin(lat1)*math.cos(d/R) +
        math.cos(lat1)*math.sin(d/R)*math.cos(brng))

  lon2 = lon1 + math.atan2(math.sin(brng)*math.sin(d/R)*math.cos(lat1),
                math.cos(d/R)-math.sin(lat1)*math.sin(lat2))

  lat2 = math.degrees(lat2)
  lon2 = math.degrees(lon2)
  
  return [lon2, lat2]

def great_circle_distance(a, b):
  R = 6378100

  lat1 = math.radians(a[1])
  lon1 = math.radians(a[0])
  lat2 = math.radians(b[1])
  lon2 = math.radians(b[0])
  
  dlon = lon2 - lon1
  dlat = lat2 - lat1
  
  a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
  # c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
  c = 2 * math.asin(math.sqrt(a)) 
  
  distance = (R * c) # Convert to meters
  
  return distance

def vehicle_stop_great_circle_distance(vehicle): 

  try:
    '''
      Returns a subset of shapes that include the previous and next stop for a given vehicle. 
    '''
    fallback_response = {
      'closest_stop_id': 0, 
      'stop_distance': -1
    }

    vehicle_info = locationcache.get(vehicle['vehicle_type'] + ':' + vehicle['vehicle_id']) 

    if not vehicle_info: 
      return fallback_response

    vehicle_info = json.loads(vehicle_info)
    
    if not 'nextStop' in vehicle_info or not 'prevStop' in vehicle_info or not vehicle_info['prevStop'] or not vehicle_info['nextStop']: 
      return {
        'closest_stop_id': 0, 
        'stop_distance': -1
      }

    shape_id = vehicle_info['shapeId']
    next_stop_dist_traveled = vehicle_info['nextStop'][0]['shape_dist_traveled']
    prev_stop_dist_traveled = vehicle_info['prevStop'][0]['shape_dist_traveled']

    # Find closest point in redis ZSET with key = vehicle_id and value = current coordinates, ordered by distance (also return distance)
    # print('shape id: ' + str(shape_id) + str(vehicle['current_user_coords'][0]) + '   and  ' + str(vehicle['current_user_coords'][1]))
    closest_shape_point = shapestore.georadius(shape_id, vehicle['current_user_coords'][0], vehicle['current_user_coords'][1], 10000)
    # print('closest point: ' + str(closest_shape_point))
 
    distance_to_shape_point = closest_shape_point[0][1]
    shape_point_info = closest_shape_point[0][0].split(':')
    shape_point_dist_traveled = shape_point_info[len(shape_point_info)-1]

    print('distance to shape point: ' + str(distance_to_shape_point))
    print('distance to next stop: ' + str(int(next_stop_dist_traveled) - int(shape_point_dist_traveled) + int(distance_to_shape_point)) )

    # 724696:24:38367 --> shape_id, sequence, distance_traveled 
    distance_to_next_stop = int(next_stop_dist_traveled) - int(shape_point_dist_traveled) + int(distance_to_shape_point)
    distance_to_prev_stop = int(next_stop_dist_traveled) - int(distance_to_shape_point) - int(prev_stop_dist_traveled)

    if distance_to_next_stop > distance_to_prev_stop: 
      return {
        'closest_stop_id': vehicle_info['prevStop'][0]['stop_id'],
        'stop_distance': distance_to_prev_stop
      }
    else: 
      return {
        'closest_stop_id': vehicle_info['nextStop'][0]['stop_id'], 
        'stop_distance': distance_to_next_stop
      }
  
  except Exception as e:
    capture_exception(e)
    print('exception: ' + str(e))
    return fallback_response


    # cursor = db.cursor(dictionary=True,buffered=True) 
    # cursor.execute("""SELECT * 
    #                   FROM shapes S 
    #                   WHERE S.shape_id = %s
    #                   AND shape_dist_traveled >= %s
    #                   AND shape_dist_traveled <= %s""", (shape_id, int(prev_stop_dist_traveled), int(next_stop_dist_traveled)))
    # shape_points = cursor.fetchall() 

  # else:
    # cursor.close()

  # try:   
  #   frame = nv.FrameE(a=6371e3, f=0)
  #   min_distance = 1000000
  #   current_path = {}

  #   for i in range(len(shape_points) - 1): 
  #     j = int(i) + 1
        
  #     # Get line with smallest cross track distance
  #     start_point = frame.GeoPoint(float(shape_points[i]['shape_pt_lat']), float(shape_points[i]['shape_pt_lon']), degrees=True)
  #     end_point = frame.GeoPoint(float(shape_points[j]['shape_pt_lat']), float(shape_points[j]['shape_pt_lon']), degrees=True)
  #     along_point = frame.GeoPoint(vehicle['current_neighbor_coords'][1], vehicle['current_neighbor_coords'][0], degrees=True)
  #     path = nv.GeoPath(start_point, end_point)

  #     track_distance = path.cross_track_distance(along_point, method='greatcircle').ravel() 

  #     if track_distance < min_distance: 
  #       min_distance = track_distance
  #       current_path = {  'start_lat': float(shape_points[i]['shape_pt_lat']), 
  #                         'start_lon': float(shape_points[i]['shape_pt_lon']), 
  #                         'start_shape_pt_sequence': shape_points[i]['shape_pt_sequence'],
  #                         'start_shape_dist_traveled': shape_points[i]['shape_dist_traveled'],
  #                         'end_lat': float(shape_points[j]['shape_pt_lat']), 
  #                         'end_lon': float(shape_points[j]['shape_pt_lon']), 
  #                         'end_shape_pt_sequence': shape_points[j]['shape_pt_sequence'], 
  #                         'end_shape_dist_traveled': shape_points[j]['shape_dist_traveled']
  #                       }

  #       path_point = path.closest_point_on_great_circle(along_point)


  #   normalized_point = [path_point.latitude_deg[0], path_point.longitude_deg[0]]

  #   distance_to_next_shape = great_circle_distance(normalized_point, [current_path['end_lat'], current_path['end_lon']]) 
  #   distance_to_prev_shape = great_circle_distance(normalized_point, [current_path['start_lat'], current_path['start_lon']])
  #   current_path['normalized_point'] = normalized_point
  #   distance_to_next_stop = next_stop_dist_traveled - current_path['end_shape_dist_traveled'] - distance_to_next_shape
  #   distance_to_prev_stop = (current_path['start_shape_dist_traveled'] - prev_stop_dist_traveled) + distance_to_prev_shape

  #   if distance_to_next_stop > distance_to_prev_stop: 
  #     return {
  #       'closest_stop_id': vehicle_info['nextStop'][0]['stop_id'], 
  #       'stop_distance': distance_to_next_stop
  #     }
  #   else: 
  #     return {
  #       'closest_stop_id': vehicle_info['prevStop'][0]['stop_id'], 
  #       'stop_distance': distance_to_prev_stop
  #     }

def transition(candidate, vehicle): 
  non_direct_tolerance = 1000 # Tuning parameter
  # Calculate 3D distance 
  great_circle_distance = candidate['closest_stop']['stop_distance'] + vehicle['closest_stop']['stop_distance']
  transition_prob = (1 / non_direct_tolerance) * np.exp((-great_circle_distance / non_direct_tolerance))
  return transition_prob
  # Transition formula: [(1 / non_direct_tolerance) * np.exp((- row['distance_difference'] / non_direct_tolerance)) for index, row in vehicle_candidates_df.iterrows()]

  # return False

def transition_matrix(candidate, fleet): 

  # "nijmegen": { "brussels": 0.6, "amsterdam": 0.4, "nijmegen": 0.8 }

  transition_item_prob = {}
  for index, vehicle in fleet.iterrows(): 
    if candidate['vehicle_id'] == vehicle['vehicle_id']: 
      transition_item_prob[vehicle['vehicle_id']] = 1
    elif candidate['closest_stop']['closest_stop_id'] == vehicle['closest_stop']['closest_stop_id']: 
      transition_item_prob[vehicle['vehicle_id']] = transition(candidate, vehicle)
    # else: 
    #   return False 
      # Fill with 0?

  transition_candidate_prob = {}
  transition_candidate_prob[candidate['vehicle_id']] = transition_item_prob

  return transition_candidate_prob

def dptable(V):
  # Print a table of steps from dictionary
  yield " ".join(("%12d" % i) for i in range(len(V)))
  for state in V[0]:
    yield "%.7s: " % state + " ".join("%.7s" % ("%f" % v[state]["prob"]) for v in V)

def viterbi(obs, states, start_p, trans_p, emit_p): 
  V = [{}]
  for st in states: 
    V[0][st] = { "prob": start_p[st] * emit_p[st][obs[0]], "prev": None }
  
  # Run Viterbi when t > 0 
  for t in range(1, len(obs)): 
    V.append({})
    for st in states: 
      max_tr_prob = V[t-1][states[0]]["prob"]*trans_p[states[0]][st]

      prev_st_selected = states[0]

      for prev_st in states[1:]:
        tr_prob = V[t-1][prev_st]["prob"]*trans_p[prev_st][st]
        if tr_prob > max_tr_prob:
          max_tr_prob = tr_prob
          prev_st_selected = prev_st 
      
      max_prob = max_tr_prob * emit_p[st][obs[t]]
      V[t][st] = { "prob": max_prob, "prev": prev_st_selected }
  
  for line in dptable(V):
    print(line)

  opt = []
  max_prob = max(value["prob"] for value in V[-1].values())
  previous = None 

  for st, data in V[-1].items(): 
    if data['prob'] == max_prob: 
      opt.append(st) 
      previous = st 
      break 

  # Follow the backtrack till the first observation
  for t in range(len(V) - 2, -1, -1):
      opt.insert(0, V[t + 1][previous]["prev"])
      previous = V[t + 1][previous]["prev"]

  highest_match = { "prob": 0 }
  for state in V[-1]:
    if V[-1][state]["prob"] > highest_match["prob"]: 
      highest_match = { "vehicle_id": state, "prob": V[-1][state]["prob"] }
    print('deze state: ' + str(state) + str(V[-1][state]))
  # print('max stuff: ' + str(max(value for value in V[-1].values())))
  
  print('The steps of states are ' + ' '.join(opt) + ' with highest probability of %s' % max_prob)

  return highest_match
