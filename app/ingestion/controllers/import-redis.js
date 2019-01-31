const LatLon = require('../movable.js');
const Sentry = require('@sentry/node');
const utils = require('../utils')
// const fs = require('fs')
const pool = require('../database')
const moment = require('moment-timezone')
const _ = require('lodash')
const redisClient = require('../redis-client')

// var stream = fs.createWriteStream("append.txt", {flags:'a'});

const importData = async data => {
  var row = {
    speed: data.speed, 
    type: data.type, 
    id: data.id + ':latest', 
    datetimeUnix: data.datetimeUnix
  }

  try {
    const vehiclePrevRaw = await redisClient.get(data.id + ':latest')

    if(vehiclePrevRaw) {
      const vehiclePrev = JSON.parse(vehiclePrevRaw)
      const vehiclePointPrev = await redisClient.geopos('items', data.id + ':latest')
      const prevIdentifier = data.id + ':' + vehiclePrev['datetimeUnix']
      redisClient.set(prevIdentifier, JSON.stringify(vehiclePrev), 'EX', 40)

      if(vehiclePointPrev[0]) {
        redisClient.geoadd('items', vehiclePointPrev[0][0], vehiclePointPrev[0][1], prevIdentifier)

        const prevPoint = new LatLon(vehiclePointPrev[0][1], vehiclePointPrev[0][0])
        const nextPoint = new LatLon(data.latitude, data.longitude)
      
        row.bearing = prevPoint.bearingTo(nextPoint)
        row.speedPerSecond = prevPoint.speedPerSecond(nextPoint, vehiclePrev.datetimeUnix, data.datetimeUnix)
      } else {
        row.bearing = -1 
        row.speedPerSecond = 0
      }
    } else {
      row.bearing = -1 
      row.speedPerSecond = 0 
    }

    redisClient.set(data.id + ':latest', JSON.stringify(row), 'EX', 40)
    redisClient.geoadd('items', data.longitude, data.latitude, data.id + ':latest')
  } catch(err) {
    Sentry.captureException(err)
  }
}

const updateData = async (identifier, data) => {

  try {
    
    if(data.type === 'vehicle') {

      const tripInfo = await pool.query('SELECT * FROM trips WHERE realtime_trip_id = ?', [identifier.replace('vehicle:','')])
      
      if(tripInfo[0]) {
        data.destination = tripInfo[0].trip_headsign
        data.shapeId = tripInfo[0].shape_id
      

        const formattedMeasurementTimestamp = moment(data.measurementTimestamp, moment.ISO_8601)
                                                .tz('Europe/Amsterdam')
                                                .subtract(data.delay_seconds, 'seconds')
                                                .format('HH:mm:ss')

        const vehicleLine = await pool.query(`SELECT route_short_name 
                                            FROM routes 
                                            WHERE route_id = ?`, [tripInfo[0].route_id])
        data.linenumber = vehicleLine[0].route_short_name                                        

        data.nextStop = await pool.query(`SELECT * 
                                          FROM stop_times ST
                                          WHERE trip_id = ?
                                          AND arrival_time > ?
                                          ORDER BY arrival_time ASC
                                          LIMIT 0,1`, [tripInfo[0].trip_id, formattedMeasurementTimestamp])

        data.prevStop = await pool.query(`SELECT * 
                                          FROM stop_times  
                                          WHERE trip_id = ?
                                          AND departure_time < ?
                                          ORDER BY departure_time DESC
                                          LIMIT 0,1`, [tripInfo[0].trip_id, formattedMeasurementTimestamp])

        if(data.nextStop.length === 0 && data.prevStop) {
          // console.log('time: ', formattedMeasurementTimestamp, '  and prev stop: ', data.prevStop[0].stop_sequence)
        } else if(data.nextStop.length === 0 && data.prevStop.length === 0) {
          console.log('no stops found')
        }                                       
      }                               

      redisClient.set(identifier, JSON.stringify(data), 'EX', 40)
    }

    if(data.type === 'train') {
      
      const plannedDeparturePlatform = _.get(data, 'Trein.0.TreinVertrekSpoor.0.SpoorNummer.0')
      const plannedDeparturePlatformPart = _.get(data, 'Trein.0.TreinVertrekSpoor.0.SpoorFase.0')
      const actualDeparturePlatform = _.get(data, 'Trein.0.TreinVertrekSpoor.1.SpoorNummer.0')
      const actualDeparturePlatformPart = _.get(data, 'Trein.0.TreinVertrekSpoor.1.SpoorFase.0')

      // For which station is this? 
      if(plannedDeparturePlatform !== actualDeparturePlatform) {
        // console.log('different platform: ', _.get(data, 'Trein.0.TreinVertrekSpoor'))
      }

      const destination = _.get(data, 'Trein.0.PresentatieTreinEindBestemming.0.Uitingen.0.Uiting.0')

      const tripInfo = await pool.query('SELECT * FROM trips T JOIN calendar_dates CD ON T.service_id = CD.service_id WHERE trip_short_name = ? AND CD.date = ?', [identifier.replace('train:', ''), moment().format('YYYYMMDD')])
      // const tripInfo = await pool.query('SELECT * FROM trips WHERE trip_short_name = ? AND trip_headsign = ?', [identifier.replace('train:', ''), destination])
      if(tripInfo[0]) {
        data.destination = tripInfo[0].trip_headsign
        data.shapeId = tripInfo[0].shape_id
      

        const formattedMeasurementTimestamp = moment(data.measurementTimestamp, moment.ISO_8601)
                                                .tz('Europe/Amsterdam')
                                                .subtract(data.delay_seconds, 'seconds')
                                                .format('HH:mm:ss')

        data.nextStop = await pool.query(`SELECT * 
                                          FROM stop_times ST
                                          WHERE trip_id = ?
                                          AND arrival_time > ?
                                          ORDER BY arrival_time ASC
                                          LIMIT 0,1`, [tripInfo[0].trip_id, formattedMeasurementTimestamp])

        data.prevStop = await pool.query(`SELECT * 
                                          FROM stop_times  
                                          WHERE trip_id = ?
                                          AND departure_time < ?
                                          ORDER BY departure_time DESC
                                          LIMIT 0,1`, [tripInfo[0].trip_id, formattedMeasurementTimestamp])

        if(data.nextStop.length === 0 && data.prevStop) {
          // console.log('time: ', formattedMeasurementTimestamp, '  and prev stop: ', data.prevStop[0].stop_sequence)
        } else if(data.nextStop.length === 0 && data.prevStop.length === 0) {
          console.log('no stops found')
        }
      }  else {
        console.log('no trip found for: ', identifier.replace('train:', ''), ' towards: ', destination, ' on this day: ', moment().format('YYYYMMDD'))
      }

      redisClient.set(identifier, JSON.stringify(data), 'EX', 40)
    }
      
  } catch(err) {  
    Sentry.captureException(err)
  }
  
}

const locationSanitaryCheck = async (id) => {
  // Get all Redis geo items 
  let cursor = 0 
  vehicleLocations = await redisClient.zscan('items', cursor, 'match', `${id}:*`)
  /*
  * Foreach item: 
  *   check if item exists in 
  * 
  */
}

module.exports = { importData: importData, updateData: updateData, locationSanitaryCheck: locationSanitaryCheck }