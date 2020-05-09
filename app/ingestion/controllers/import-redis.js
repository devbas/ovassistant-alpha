const LatLon = require('../movable.js');
const Sentry = require('@sentry/node');
const utils = require('../utils')

const moment = require('moment-timezone')
const _ = require('lodash')
const redisClient = process.env.INGESTION_PERSIST === 'yes' ? require('../redis-client-persist') : require('../redis-client')
const fs = require('fs')
// var stream = fs.createWriteStream("realtime.csv", {flags:'a'});

const importData = async (data, pgPool) => {
  var row = {
    speed: data.speed, 
    type: data.type, 
    id: data.id + ':latest', 
    datetimeUnix: data.datetimeUnix, 
    latitude: data.latitude,
    longitude: data.longitude 
  }

  var isPersist = process.env.INGESTION_PERSIST

  try {

    // stream.write(`${data.id},${row.datetimeUnix},${row.latitude},${row.longitude}\n`)
    const vehiclePrevRaw = await redisClient.get(data.id + ':latest')

    if(vehiclePrevRaw) {
      const vehiclePrev = JSON.parse(vehiclePrevRaw)
      const vehiclePointPrev = await redisClient.geopos('items', data.id + ':latest')
      const prevIdentifier = data.id + ':' + vehiclePrev['datetimeUnix']

      if (isPersist === 'yes') {
        redisClient.set(prevIdentifier, JSON.stringify(vehiclePrev))
      } else { 
        redisClient.set(prevIdentifier, JSON.stringify(vehiclePrev), 'EX', 40)
      }

      if(vehiclePointPrev[0]) {

        if (isPersist === 'yes') {
          redisClient.geoadd('items', vehiclePointPrev[0][0], vehiclePointPrev[0][1], prevIdentifier)
        } else {
          redisClient.geoadd('items', vehiclePointPrev[0][0], vehiclePointPrev[0][1], prevIdentifier)
        }

        const prevPoint = new LatLon(vehiclePointPrev[0][1], vehiclePointPrev[0][0])
        const nextPoint = new LatLon(data.latitude, data.longitude)
      
        row.bearing = prevPoint.bearingTo(nextPoint)
        row.speedPerSecond = prevPoint.speedPerSecond(nextPoint, vehiclePrev.datetimeUnix, data.datetimeUnix)
        row.vehiclePrevPoint = prevIdentifier
      } else {
        row.bearing = -1 
        row.speedPerSecond = 0
      }
    } else {
      row.bearing = -1 
      row.speedPerSecond = 0 
    }

    if (isPersist === 'yes') {
      redisClient.set(data.id + ':latest', JSON.stringify(row))
      redisClient.geoadd('items', data.longitude, data.latitude, data.id + ':latest')
    } else {
      redisClient.set(data.id + ':latest', JSON.stringify(row), 'EX', 40)
      redisClient.geoadd('items', data.longitude, data.latitude, data.id + ':latest')
    }
  } catch(err) {
    Sentry.captureException(err)
  }
}

const updateData = async (identifier, data, pgPool) => {

  try {
    
    var isPersist = process.env.INGESTION_PERSIST
    const client = await pgPool.connect()

    if(data.type === 'vehicle') { 

      const tripInfo = await client.query('SELECT * FROM trips WHERE realtime_trip_id = $1', [identifier.replace('vehicle:','')])
      
      if(tripInfo[0]) {
        data.destination = tripInfo[0].trip_headsign
        data.shapeId = tripInfo[0].shape_id
      

        const formattedMeasurementTimestamp = moment(data.measurementTimestamp, moment.ISO_8601)
                                                .tz('Europe/Amsterdam')
                                                .subtract(data.delay_seconds, 'seconds')
                                                .format('HH:mm:ss')

        const vehicleLine = await client.query(`SELECT route_short_name 
                                              FROM routes 
                                              WHERE route_id = $1`, [tripInfo[0].route_id])                                         

        data.linenumber = vehicleLine[0].route_short_name                                        

        data.nextStop = await client.query(`SELECT * 
                                          FROM stop_times ST
                                          WHERE trip_id = $1
                                          AND arrival_time > $2
                                          ORDER BY arrival_time ASC
                                          LIMIT 0,1`, [tripInfo[0].trip_id, formattedMeasurementTimestamp])

        data.prevStop = await client.query(`SELECT * 
                                          FROM stop_times  
                                          WHERE trip_id = $1
                                          AND departure_time < $2
                                          ORDER BY departure_time DESC
                                          LIMIT 0,1`, [tripInfo[0].trip_id, formattedMeasurementTimestamp])

        if(data.nextStop.length === 0 && data.prevStop) {
          // console.log('time: ', formattedMeasurementTimestamp, '  and prev stop: ', data.prevStop[0].stop_sequence)
        } else if(data.nextStop.length === 0 && data.prevStop.length === 0) {
          console.log('no stops found')
        }                                       
      }                               
      
      if (isPersist === 'yes') {
        redisClient.set(identifier, JSON.stringify(data))
      } else {
        redisClient.set(identifier, JSON.stringify(data), 'EX', 40)
      }
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

      const tripInfo = await client.query('SELECT * FROM trips T JOIN calendar_dates CD ON T.service_id = CD.service_id WHERE trip_short_name = $1 AND CD.date = $2', [identifier.replace('train:', ''), moment().format('YYYYMMDD')])

      if(tripInfo[0]) {
        data.destination = tripInfo[0].trip_headsign
        data.shapeId = tripInfo[0].shape_id
      

        const formattedMeasurementTimestamp = moment(data.measurementTimestamp, moment.ISO_8601)
                                                .tz('Europe/Amsterdam')
                                                .subtract(data.delay_seconds, 'seconds')
                                                .format('HH:mm:ss')

        data.nextStop = await client.query(`SELECT * 
                                          FROM stop_times ST
                                          WHERE trip_id = $1
                                          AND arrival_time > $2
                                          ORDER BY arrival_time ASC
                                          LIMIT 0,1`, [tripInfo[0].trip_id, formattedMeasurementTimestamp])

        data.prevStop = await client.query(`SELECT * 
                                          FROM stop_times  
                                          WHERE trip_id = $1
                                          AND departure_time < $2
                                          ORDER BY departure_time DESC
                                          LIMIT 0,1`, [tripInfo[0].trip_id, formattedMeasurementTimestamp])

        if(data.nextStop.length === 0 && data.prevStop) {
          // console.log('time: ', formattedMeasurementTimestamp, '  and prev stop: ', data.prevStop[0].stop_sequence)
        } else if(data.nextStop.length === 0 && data.prevStop.length === 0) {
          console.log('no stops found')
        }
      }  else {
        // console.log('no trip found for: ', identifier.replace('train:', ''), ' towards: ', destination, ' on this day: ', moment().format('YYYYMMDD'))
      }

      if (isPersist === 'yes') {
        redisClient.set(identifier, JSON.stringify(data))
      } else {
        redisClient.set(identifier, JSON.stringify(data), 'EX', 40)
      }
    }
      
  } catch(err) {  
    Sentry.captureException(err)
  } finally {
    client.release()
  }
  
}

const locationSanitaryCheck = async (id) => {
  // Get all Redis geo items 
  // let cursor = 0 
  // vehicleLocations = await redisClient.zscan('items', cursor, 'match', `${id}:*`)
  /*
  * Foreach item: 
  *   check if item exists in 
  * 
  */
}

module.exports = { importData: importData, updateData: updateData, locationSanitaryCheck: locationSanitaryCheck }