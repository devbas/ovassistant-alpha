import os

redis = {
  'host': os.environ['REDIS_HOST'], 
  'port': os.environ['REDIS_PORT'], 
  'db': os.environ['REDIS_DB'], 
  'shape_db': os.environ['REDIS_SHAPE_DB'], 
  'layer_db': os.environ['REDIS_LAYER_DB'], 
  'decode_responses': True 
}

psql = {
  'host': os.environ['PSQL_HOST'], 
  'db': os.environ['PSQL_DB'], 
  'user': os.environ['PSQL_USER'], 
  'password': os.environ['PSQL_PASSWORD'], 
  'port': os.environ['PSQL_PORT']
}