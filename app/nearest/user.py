#!/usr/bin/env python
import config as cfg 
# import pymysql.cursors
import mysql.connector

# db = pymysql.connect(host=cfg.mysql['host'], port=cfg.mysql['port'], db=cfg.mysql['db'], user=cfg.mysql['user'], password=cfg.mysql['password'], cursorclass=pymysql.cursors.DictCursor)

def get_user_location(user_id, user_datetime): 
  try: 

    db = mysql.connector.connect(
      host=cfg.mysql['host'],
      user=cfg.mysql['user'],
      passwd=cfg.mysql['password'], 
      database=cfg.mysql['db']
    )

    cursor = db.cursor(dictionary=True) 
    cursor.execute('SELECT * FROM user_location WHERE user_id = %s AND datetime > (%s - 60) ORDER BY datetime DESC LIMIT 0,1', (user_id, int(user_datetime)))
    prev_user_location = cursor.fetchone()
    print('prev user location' + str(prev_user_location))
    db.close()
    return prev_user_location
    
  except: 
    print('Unexpected error: ')