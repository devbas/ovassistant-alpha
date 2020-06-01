const LatLon = require('../movable.js');
const Sentry = require('@sentry/node');
const utils = require('../utils')

const _ = require('lodash')
const redisClient = process.env.INGESTION_PERSIST === 'yes' ? require('../redis-client-persist') : require('../redis-client')
const fs = require('fs')
// var stream = fs.createWriteStream("realtime.csv", {flags:'a'});

const format = require('date-fns/format')
const parseISO = require('date-fns/parseISO')
const sub = require('date-fns/sub')
const tzFormat = require('date-fns-tz/format')

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

const updateTrajectory = (points, delay, oldDelay) => {
  let linestring = `ST_GeomFromEWKT('SRID=4326;LINESTRINGM(`
  let counter = 0 

  if(points.length === 0) {
    linestring = linestring + `)')`
  } else {
    points.forEach(point => {
      const pointData = point.split(' ')

      const timestamp = parseInt(pointData[2])
      counter = counter + 1 

      linestring = linestring + `${pointData[0]} ${pointData[1]} ${(timestamp + oldDelay) - delay}`

      counter !== points.length ? linestring = linestring + ', ' : linestring = linestring + ")')"
    })
  }

  return linestring
}

const updateData = async (identifier, data, pgPool) => {

  const client = await pgPool.connect()

  try {
    
    var isPersist = process.env.INGESTION_PERSIST

    if(data.type === 'vehicle') { 

      const { rows: tripInfo } = await client.query('SELECT T.* FROM trips T JOIN calendar_dates CD ON CD.service_id = T.service_id WHERE T.realtime_trip_id = $1 AND CD.date = $2', [identifier.replace('vehicle:',''), data.operatingDay.split('-').join('')]);
      if(tripInfo[0]) {
        data.destination = tripInfo[0].trip_headsign
        data.shapeId = tripInfo[0].shape_id
      
        const formattedMeasurementTimestamp = tzFormat(sub(parseISO(data.measurementTimestamp), { seconds: data.delay_seconds ? data.delay_seconds : 0 }), 'HH:mm:ss', { timeZone: 'Europe/Amsterdam' })

        const { rows: vehicleLine } = await client.query(`SELECT route_short_name 
                                              FROM routes 
                                              WHERE route_id = $1
                                              LIMIT 1`, [tripInfo[0].route_id])                                        

        data.linenumber = vehicleLine[0].route_short_name                                        

        const { rows: nextStop } = await client.query(`SELECT * 
                                          FROM stop_times ST
                                          WHERE trip_id = $1
                                          AND arrival_time > $2
                                          ORDER BY arrival_time ASC
                                          LIMIT 1`, [tripInfo[0].trip_id, formattedMeasurementTimestamp])
        data.nextStop = nextStop                                          

        const { rows: prevStop } = await client.query(`SELECT * 
                                          FROM stop_times  
                                          WHERE trip_id = $1
                                          AND departure_time < $2
                                          ORDER BY departure_time DESC
                                          LIMIT 1`, [tripInfo[0].trip_id, formattedMeasurementTimestamp])
        data.prevStop = prevStop                                           

        if(data.nextStop.length === 0 && data.prevStop) {
          // console.log('time: ', formattedMeasurementTimestamp, '  and prev stop: ', data.prevStop[0].stop_sequence)
        } else if(data.nextStop.length === 0 && data.prevStop.length === 0) {
          console.log('no stops found')
        }
        
        if(data.delay_seconds && data.has_delay && data.longitude && data.latitude) {
          const { rows: trajectory } = await client.query(`SELECT ST_AsText(geom) AS geom, delay_seconds FROM trajectories WHERE trip_id = $1`, [tripInfo[0].trip_id])
          const trajectoryPoints = trajectory[0].geom.substring(trajectory[0].geom.lastIndexOf('(') + 1, trajectory[0].geom.lastIndexOf(')')).split(',')

          let query = `UPDATE trajectories SET geom = `

          const updatedTrajectory = updateTrajectory(trajectoryPoints, data.delay_seconds, trajectory[0].delay_seconds ? parseInt(trajectory[0].delay_seconds) : 0)

          query = query + updatedTrajectory + `, delay_seconds = $1 WHERE trip_id = $2`

          const { rows: scheduledLocationBefore } = await client.query(`SELECT ST_AsText(ST_LocateAlong(geom, $1)) AS point
                                              FROM trajectories
                                              WHERE trip_id = $2
                                              LIMIT 1`, [data.datetimeUnix, tripInfo[0].trip_id])

          await client.query(query, [data.delay_seconds, tripInfo[0].trip_id])

          const { rows: scheduledLocationAfter } = await client.query(`SELECT ST_AsText(ST_LocateAlong(geom, $1)) AS point
                                              FROM trajectories
                                              WHERE trip_id = $2
                                              LIMIT 1`, [data.datetimeUnix, tripInfo[0].trip_id])

          const { rows: scheduledLocationAfterDistance } = await client.query(`SELECT ST_Distance_Sphere('SRID=4326;POINT(${data.longitude} ${data.latitude})', ST_LocateAlong(geom, $1)) AS delay_distance_noise
          FROM trajectories
          WHERE trip_id = $2
          LIMIT 1`, [data.datetimeUnix, tripInfo[0].trip_id])                                              

          console.log({ point: scheduledLocationBefore[0].point, baseline: [data.longitude, data.latitude], updated: scheduledLocationAfter[0].point, tripId: tripInfo[0].trip_id, distance: scheduledLocationAfterDistance[0].delay_distance_noise })                                    
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

      const { rows: tripInfo } = await client.query('SELECT * FROM trips T JOIN calendar_dates CD ON T.service_id = CD.service_id WHERE trip_short_name = $1 AND CD.date = $2 LIMIT 1', [identifier.replace('train:', ''), data.operatingDay.split('-').join('')])

      if(tripInfo[0]) {
        data.destination = tripInfo[0].trip_headsign
        data.shapeId = tripInfo[0].shape_id
      
        const formattedMeasurementTimestamp = tzFormat(sub(parseISO(data.measurementTimestamp), { seconds: data.delay_seconds ? data.delay_seconds : 0 }), 'HH:mm:ss', { timeZone: 'Europe/Amsterdam' })

        const { rows: nextStop } = await client.query(`SELECT * 
                                          FROM stop_times ST
                                          WHERE trip_id = $1
                                          AND arrival_time > $2
                                          ORDER BY arrival_time ASC
                                          LIMIT 1`, [tripInfo[0].trip_id, formattedMeasurementTimestamp])
        data.nextStop = nextStop                                       

        const { rows: prevStop } = await client.query(`SELECT * 
                                          FROM stop_times  
                                          WHERE trip_id = $1
                                          AND departure_time < $2
                                          ORDER BY departure_time DESC
                                          LIMIT 1`, [tripInfo[0].trip_id, formattedMeasurementTimestamp])
        data.prevStop = prevStop

        if(data.nextStop.length === 0 && data.prevStop) {
          // console.log('time: ', formattedMeasurementTimestamp, '  and prev stop: ', data.prevStop[0].stop_sequence)
        } else if(data.nextStop.length === 0 && data.prevStop.length === 0) {
          console.log('no stops found')
        }

        if(data.delay_seconds && data.has_delay && data.longitude && data.latitude) {
          const { rows: trajectory } = await client.query(`SELECT ST_AsText(geom) AS geom, delay_seconds FROM trajectories WHERE trip_id = $1`, [tripInfo[0].trip_id])
          const trajectoryPoints = trajectory[0].geom.substring(trajectory[0].geom.lastIndexOf('(') + 1, trajectory[0].geom.lastIndexOf(')')).split(',')

          let query = `UPDATE trajectories SET geom = `

          const updatedTrajectory = updateTrajectory(trajectoryPoints, data.delay_seconds, trajectory[0].delay_seconds ? parseInt(trajectory[0].delay_seconds) : 0)

          query = query + updatedTrajectory + `, delay_seconds = $1 WHERE trip_id = $2`

          const { rows: scheduledLocationBefore } = await client.query(`SELECT ST_Distance_Sphere('SRID=4326;POINT(${data.longitude} ${data.latitude})', ST_LocateAlong(geom, $1)) AS delay_distance_noise
          FROM trajectories
          WHERE trip_id = $2
          LIMIT 1`, [data.datetimeUnix, tripInfo[0].trip_id])

          console.log({ distanceNoiseBefore: scheduledLocationBefore[0].delay_distance_noise, tripId: tripInfo[0].trip_id })

          await client.query(query, [data.delay_seconds, tripInfo[0].trip_id])

          const { rows: scheduledLocationAfter } = await client.query(`SELECT ST_Distance_Sphere('SRID=4326;POINT(${data.longitude} ${data.latitude})', ST_LocateAlong(geom, $1)) AS delay_distance_noise
          FROM trajectories
          WHERE trip_id = $2
          LIMIT 1`, [data.datetimeUnix, tripInfo[0].trip_id])

          console.log({ distanceNoiseBefore: scheduledLocationAfter[0].delay_distance_noise, tripId: tripInfo[0].trip_id })
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
    
    client.release()
  } catch(err) {  
    client.release()
    console.log({ err: err, data: data })
    Sentry.captureException(err)
  }
  
}

module.exports = { importData: importData, updateData: updateData }