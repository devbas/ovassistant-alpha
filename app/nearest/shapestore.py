#!/usr/bin/env python3

import redis 
import config as cfg 

redis_client = redis.StrictRedis(host=cfg.redis['host'], port=cfg.redis['port'], db=cfg.redis['shape_db'], decode_responses=cfg.redis['decode_responses'])

def georadius(vehicle_id, lon, lat, radius): 
  return redis_client.georadius(vehicle_id, lon, lat, radius, 'm', 'WITHDIST', 'WITHCOORD', 'COUNT', 1, 'ASC')