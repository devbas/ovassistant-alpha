#!/usr/bin/env python3
import locationcache
import pandas as pd 
import transportgeo
import numpy as np 
import json
from sentry_sdk import capture_exception
import config as cfg 

def get_vehicle_matches(lon, lat, user_datetime, user_id): 

  try: 
    observations = locationcache.get_vehicle_location_state_by_time(lon, lat, user_datetime)
    # print('observations: ', str(observations))
    '''
      Calculate the emission probability as proposed by Newson et al. (2009)
    '''
    gps_error_margin = 4000.07 # Derived from Newson et al. Potential tuning parameter
    observations['emission_prob'] = [(1 / (np.square(2 * np.pi) * gps_error_margin)) * np.exp(-0.5 * (row['user_vehicle_distance'] / gps_error_margin)**2) * 100 for index, row in observations.iterrows()]

    '''
      Calculate the transition for each vehicle to each vehicle. 
    '''
    observations['transition_matrix'] = [transportgeo.transition_matrix(vehicle, observations) for index, vehicle in observations.iterrows()]

    # Get all other observations from database
    vit_layers = locationcache.get_observations(user_id, user_datetime) 

    # Let Mr. Viterbi do his magic
    if not vit_layers.empty: 
      # Get all unique vehicles from observations
      states = vit_layers['vehicle_id'].unique()
      vit_layers = vit_layers.sort_values(by=['device_datetime'], ascending=False)
      
      if len(vit_layers) > 5: 
        try: 
          # Get number of unique inserted_at 
          num_layers = [str(i) for i in range(0, len(vit_layers['device_datetime'].unique()))]
          start_prob = dict()
          emit_prob = dict()
          trans_prob = dict()
          i = 1
          for neighbor_datetime in vit_layers['device_datetime'].unique(): 
            layer = vit_layers[vit_layers['device_datetime'] == neighbor_datetime]
            nonmatching = [state for state in states if state not in layer['vehicle_id'].unique()]

            for index, vehicle in layer.iterrows():

              if not vehicle['vehicle_id'] in emit_prob: 
                emit_prob[vehicle['vehicle_id']] = dict() 

              emit_prob[vehicle['vehicle_id']][str(i - 1)] = vehicle['emission_prob']

              if i == 1: 
                start_prob[vehicle['vehicle_id']] = vehicle['emission_prob']
              
              if i == len(num_layers): 

                if isinstance(vehicle['transition_matrix'], dict): 
                  vehicle_trans_matrix = json.loads(json.dumps(vehicle['transition_matrix']))
                else: 
                  vehicle_trans_matrix = json.loads(vehicle['transition_matrix'])
                
                if not vehicle['vehicle_id'] in trans_prob: 
                  trans_prob[vehicle['vehicle_id']] = dict() 

                trans_prob[vehicle['vehicle_id']] = vehicle_trans_matrix[vehicle['vehicle_id']]

                # Fill the missing transitions with zero's     
                for state in states: 
                  if state not in trans_prob[vehicle['vehicle_id']]: 
                    trans_prob[vehicle['vehicle_id']][state] = 0
            
            # Fill the missing states with zero's
            for nonmatch in nonmatching: 
              if i == 1: 
                start_prob[nonmatch] = 0
              
              if not nonmatch in emit_prob: 
                emit_prob[nonmatch] = dict() 

              emit_prob[nonmatch][str(i - 1)] = 0

              if i == len(num_layers): 
                trans_prob[nonmatch] = dict() 

                for state in states: 
                  trans_prob[nonmatch][state] = 0

            i = i + 1

          # print('num_layers: ' + str(num_layers))
          # print('states: ' + str(states))
          # print('start_prob: ' + str(start_prob))
          # print('trans_prob: ' + str(trans_prob))
          # print('emit_prob: ' + str(emit_prob))
          matches = transportgeo.viterbi(num_layers, states, start_prob, trans_prob, emit_prob)
        
        except Exception as e:
          print('exception here: ' + str(e))
          capture_exception(e)
      else: 
        matches = False 
    else: 
      matches = False 

    # with pd.option_context('display.max_rows', None, 'display.max_columns', None):
      # print(str(observations))

    return { 'observations': observations.to_json(orient='records'), 'matches': matches }

  except Exception as e:
    capture_exception(e)
    print('exception: ' + str(e))
    return { 'observations': {}, 'matches': {} } 
