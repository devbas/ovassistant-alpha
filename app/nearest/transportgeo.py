import math
import numpy as np
import locationcache
import shapestore
import config as cfg 
import json
from sentry_sdk import capture_exception
import time

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

def transition(candidate, vehicle): 
  # non_direct_tolerance = 1000 # Tuning parameter
  std_gps_measurement = 4.07
  non_direct_tolerance = 6.2831 * std_gps_measurement

  # Calculate 3D distance 
  # print('stuff: ', str(candidate['nearest_stop_distance']), ' aand: ', str(vehicle['nearest_stop_distance']))
  great_circle_distance = candidate['nearest_stop_distance'] + vehicle['nearest_stop_distance']
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
    elif candidate['nearest_stop_id'] == vehicle['nearest_stop_id']: 
      transition_item_prob[vehicle['vehicle_id']] = transition(candidate, vehicle)

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
  
  # for line in dptable(V):
    # print(line)

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
    # print('deze state: ' + str(state) + str(V[-1][state]))
  # print('max stuff: ' + str(max(value for value in V[-1].values())))
  
  # print('The steps of states are ' + ' '.join(opt) + ' with highest probability of %s' % max_prob)
  # print('highest match: ' + str(highest_match))

  return highest_match
