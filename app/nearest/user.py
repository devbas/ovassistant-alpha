#!/usr/bin/env python
import config as cfg 
# import pymysql.cursors
import mysql.connector

def get_user_location(db, user_id, user_datetime): 
  try: 

    cursor = db.cursor(dictionary=True) 
    cursor.execute('SELECT * FROM user_location WHERE user_id = %s AND datetime > (%s - 60) ORDER BY datetime DESC LIMIT 0,1', (user_id, int(user_datetime)))
    prev_user_location = cursor.fetchone()
    print('prev user location' + str(prev_user_location))
    # db.close()
    return prev_user_location
    
  except: 
    print('Unexpected error: ')