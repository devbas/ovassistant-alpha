const Sentry = require('@sentry/node');
const pool = require('../modules/database')
const axios = require('axios')
const utils = require('../utils')
const moment = require('moment')
const _ = require('lodash')
const redisClient = require('../redis-client')
const redisLayerStore = require('../redis-layer-store')
const { Client, Pool } = require('pg')
const config = require('../config/config')

const getVehicleItemInfo = async (client, vehicle) => {
  try {

    vehicle.destination = false 
    vehicle.title_prefix = false  

    const trip = await client.query('SELECT trip_headsign, route_id, trip_id FROM trips WHERE realtime_trip_id = ? LIMIT 0,1', [vehicle.vehicle_id])

    if(!trip[0] || !trip[0].trip_headsign) {
      return vehicle 
    }

    vehicle.destination = trip[0].trip_headsign 
    vehicle.trip_id = trip[0].trip_id 

    const tripRouteName = await client.query('SELECT route_short_name FROM routes WHERE route_id = ? LIMIT 0,1', [trip[0].route_id])

    if(!tripRouteName[0] || !tripRouteName[0].route_short_name) {
      return vehicle 
    }

    vehicle.title_prefix = tripRouteName[0].route_short_name

    return vehicle 
  } catch(err) {
    Sentry.captureException(err)
    console.log('err: ', err)
  }
}

// const getVehicleItemInfo = async (vehicle) => {
//   try {

//     // First, we check if the vehicle is present in Redis cache. 
//     const cacheRaw = await redisClient.get(vehicle.vehicle_type + ':' + vehicle.vehicle_id)
//     if(!cacheRaw && vehicle.vehicle_type === 'vehicle') {
//       const trip = await pool.query('SELECT trip_headsign, route_id, trip_id FROM trips WHERE realtime_trip_id = ? LIMIT 0,1', [vehicle.vehicle_id])
//       if(trip[0] && trip[0].trip_headsign) {
//         vehicle.destination = trip[0].trip_headsign
//         vehicle.trip_id = trip[0].trip_id
//         const tripRouteName = await pool.query('SELECT route_short_name FROM routes WHERE route_id = ? LIMIT 0,1', [trip[0].route_id])
//         vehicle.title_prefix = tripRouteName[0].route_short_name
//       } else {
//         vehicle.destination = false 
//         vehicle.title_prefix = false 
//       }
     
//     } else if(!cacheRaw && vehicle.vehicle_type === 'train') { 
//       const trip = await pool.query('SELECT trip_headsign, route_id, trip_id FROM trips T JOIN calendar_dates CD ON T.service_id = CD.service_id WHERE trip_short_name = ? AND CD.date = ?', [vehicle.vehicle_id, moment().format('YYYYMMDD')])
//       if(trip[0] && trip[0].trip_headsign) {
//         vehicle.destination = trip[0].trip_headsign
//         vehicle.trip_id = trip[0].trip_id 
//         const tripRouteName = await pool.query('SELECT route_short_name FROM routes WHERE route_id = ? LIMIT 0,1', [trip[0].route_id])
//         vehicle.title_prefix = tripRouteName[0].route_short_name
//       } else {
//         vehicle.destination = false 
//         vehicle.title_prefix = false 
//       }

//     } else {
//       const cache = JSON.parse(cacheRaw)
//       vehicle.destination = cache.destination 
//       vehicle.title_prefix = vehicle.vehicle_type === 'train' ? cache.subType : cache.linenumber
//     }

//     return vehicle 
//   }
//   catch(err) {
//     Sentry.captureException(err)
//     throw(err)
//   }
//   // return new Promise(resolve => resolve(vehicle))
// }

const getVehicleCandidates = async (data) => { 

  let response = {}

  const client = new Pool(config.pg)
  // const client = new Client(config.pg)
  await client.connect()

  try {
    console.log('data', data)
    if(!data.userId || !data.lon || !data.lat || !data.datetime) {
      throw { 'message': 'Make sure to send the longitude, latitude and datetime for an event.', 'status': 500 }
    }

    // Save the user location for further analysis
    pool.query('INSERT INTO user_location SET `user_id` = ?, `lon` = ?, `lat` = ?, `datetime` = ?', 
                      [parseInt(data.userId), data.lon, data.lat, data.datetime])

    // Get vehicle candidates from Nearest   
    const vehicleCandidatesRaw = await axios.get(`http://nearest:9002/classify/location?lon=${data.lon}&lat=${data.lat}&datetime=${data.datetime}&user_id=${data.userId}`)
                                              .catch(err => {
                                                Sentry.captureException(err)
                                                throw { 'message': 'Something went wrong on our end. Please try again later.', 'status': 500 }
                                              })
    // console.log('raw: ', vehicleCandidatesRaw.data.observations)
    // const vehicleData = JSON.parse(vehicleCandidatesRaw.data)
    let vehicleCandidates = vehicleCandidatesRaw.data.observations ? vehicleCandidatesRaw.data.observations : false 
    // let vehicleCandidates = JSON.parse(vehicleCandidatesRaw.data.observations)
    const matches = vehicleCandidatesRaw.data.matches

    if(!_.isEmpty(vehicleCandidates)) {
      vehicleCandidates = JSON.parse(vehicleCandidates)
      
      vehicleCandidates = await Promise.all(vehicleCandidates.map(getVehicleItemInfo.bind(null, client)))
      const userLayersRaw = await redisLayerStore.get(data.userId)

      if(userLayersRaw === null) {
        await redisLayerStore.set(data.userId, JSON.stringify([vehicleCandidates]))
      } else {
        let userLayers = JSON.parse(userLayersRaw)
        userLayers = userLayers.slice(-1 * 5)
        
        await redisLayerStore.set(data.userId, JSON.stringify([...userLayers, vehicleCandidates]))
      }

      // const response = { vehicleCandidates: vehicleCandidates, matches: matches }
      response.responseType = 'vehicle'
      response.response = {} 
      response.response.vehicleCandidates = vehicleCandidates
      response.response.matches = matches 

    } else {
      const situation = await travelSituationRouter({ 
        vehicleCandidates: vehicleCandidates, 
        matches: matches, 
        userData: {
          lat: data.lat, 
          lon: data.lon 
        }, 
        client: client 
      })

      response.responseType = situation.responseType
      response.response = situation.response
    }
    
    return response
  } catch(err) {
    console.log('err: ', err)
  } finally {
    client.release()
  } 

}

const getStopTransfers = async (stopId, timetableDate, timetableTime) => {

  const timetableTimeLimit = moment(timetableTime, 'HH:mm:ss').add(1, 'hours').format('HH:mm:ss')

  const testTime = moment('23:23:23', 'HH:mm:ss').add(1, 'hours').format('HH:mm:ss')

  const parentStop = await pool.query('SELECT parent_station FROM stops WHERE stop_id = ? LIMIT 0,1', [stopId])

  let transfersRaw = []
  if(parentStop[0] && parentStop[0].parentStop) {
    transfersRaw = await pool.query(`SELECT * 
      FROM stop_times ST 
      JOIN trips T 
      ON ST.trip_id = T.trip_id 
      INNER JOIN calendar_dates CD 
      ON T.service_id = CD.service_id 
      JOIN stops S 
      ON S.stop_id = ST.stop_id 
      WHERE S.parent_station = ?
      AND ST.departure_time > ?
      AND ST.departure_time < ?
      AND CD.date = ?
      AND pickup_type = 0
      ORDER BY departure_time ASC
      LIMIT 0,10`, [parentStop[0].parentStop, timetableTime, timetableTimeLimit, timetableDate])
  } else {
    transfersRaw = await pool.query(`SELECT * 
      FROM stop_times ST 
      JOIN trips T 
      ON ST.trip_id = T.trip_id 
      INNER JOIN calendar_dates CD 
      ON T.service_id = CD.service_id 
      JOIN stops S 
      ON S.stop_id = ST.stop_id 
      WHERE ST.stop_id = ?
      AND ST.departure_time > ?
      AND ST.departure_time < ?
      AND CD.date = ?
      AND pickup_type = 0
      ORDER BY departure_time ASC
      LIMIT 0,10`, [stopId, timetableTime, timetableTimeLimit, timetableDate])
  }
                                          
  const transfers = _.map(transfersRaw, async (transfer) => {
    transfer.arrival_time = utils.fixTime(transfer.arrival_time)
    transfer.departure_time = utils.fixTime(transfer.departure_time)
    const route = await pool.query('SELECT * FROM routes WHERE route_id = ?', [transfer.route_id])
    transfer.route = route[0] ? route[0] : {}
    return transfer 
  })         

  return await Promise.all(transfers)
}

const getTrip = async (data, timetableDate) => {
  if(data.type === 'vehicle') {
    return await pool.query('SELECT * FROM trips T JOIN calendar_dates CD ON T.service_id = CD.service_id WHERE T.realtime_trip_id = ? AND CD.date = ? LIMIT 0,1', [data.vehicleId, timetableDate])
  } else if(data.type === 'train') {
    if(isNaN(data.vehicleId)) {
      const vehicleId = data.vehicleId.split(':')
      data.vehicleId = vehicleId[2]
    }
    return await pool.query('SELECT * FROM trips T JOIN calendar_dates CD ON T.service_id = CD.service_id WHERE T.trip_short_name = ? AND CD.date = ? LIMIT 0,1', [data.vehicleId, timetableDate])
  } else {
    throw "no supporting datatype available"
  }
}

const getTripRoute = async (trip) => {
  const route = await pool.query('SELECT * FROM routes WHERE route_id = ? LIMIT 0,1', [trip.route_id])
  return route[0] ? route[0] : {}
}

const transformStoptimes = async (vehicleCache, stoptimes, timetableTime, timetableDate) => {

  const stops = _.map(stoptimes, async (stoptime, key) => {

    stoptime.arrival_time = utils.fixTime(stoptime.arrival_time)
    stoptime.departure_time = utils.fixTime(stoptime.departure_time)
    if(vehicleCache && vehicleCache.nextStop.length > 0) {
      if(vehicleCache.nextStop[0]['stop_sequence'] > key) {
        stoptime.has_passed = true 
      } else {
        stoptime.has_passed = false 
      }
    } else if(vehicleCache && vehicleCache.prevStop.length > 0) {
      if((vehicleCache.prevStop[0]['stop_sequence'] + 1) > key) {
        stoptime.has_passed = true 
      } else {
        stoptime.has_passed = false 
      }
    } else {
      if(moment(stoptime.departure_time, 'HH:mm:ss').isAfter(moment(timetableTime, 'HH:mm:ss'))) {
        stoptime.has_passed = false 
      } else {
        stoptime.has_passed = true 
      }
    }

    if(!stoptime.has_passed) {
      stoptime.transfers = await getStopTransfers(stoptime.stop_id, timetableDate, stoptime.arrival_time)
      
      const stop = await pool.query('SELECT * FROM stops WHERE stop_id = ?', [stoptime.stop_id])

      if(vehicleCache && vehicleCache.delay_seconds && parseInt(vehicleCache.delay_seconds) > 60) {
        stoptime.new_arrival_time = moment(stoptime.arrival_time, 'HH:mm:ss').add(vehicleCache.delay_seconds, 'seconds').format('HH:mm:ss') 
        stoptime.new_departure_time= moment(stoptime.departure_time, 'HH:mm:ss').add(vehicleCache.delay_seconds, 'seconds').format('HH:mm:ss')
      }

      return _.merge(stoptime, stop[0]) 
    } else {
      return stoptime
    }

    
  })

  return await Promise.all(stops)
}

const getVehicleContext = async (data) => {

  try {
    console.log('data: ', data)
    if(!data || !data.type || !data.vehicleId || !data.datetime) {
      throw 'Please send all parameters in the proper format.'
    }

    const vehicleRaw = await redisClient.get(data.type + ':' + data.vehicleId)
    const vehicleCache = vehicleRaw ? JSON.parse(vehicleRaw) : false 
    const timetableDate = moment(data.datetime).format('YYYYMMDD')
    const timetableTime = moment(data.datetime).format('HH:mm:ss')
    
    const trip = await getTrip(data, timetableDate)
    if(!trip[0]) {
      throw "No trip found"
    }
  
    const stoptimesRaw = await pool.query('SELECT * FROM stop_times WHERE trip_id = ? ORDER BY stop_sequence ASC', [trip[0].trip_id])
  
    const allStoptimes = await transformStoptimes(vehicleCache, stoptimesRaw, timetableTime, timetableDate)
    const upcomingStoptimes = _.filter(allStoptimes, { has_passed: false })

    if(vehicleCache && vehicleCache.delay_seconds && parseInt(vehicleCache.delay_seconds) > 60) {
      trip[0].has_delay = true 
      trip[0].delay_seconds = vehicleCache.delay_seconds
    } else {
      trip[0].has_delay = false 
    }

    trip[0].stoptimes = upcomingStoptimes
    trip[0].route = await getTripRoute(trip[0])
    return trip[0]

  } catch(err) {
    Sentry.captureException(err)
    throw err
  }

}

const parseVehicleItemInfo = async function(data) {

  try {

    if(!data || !data.type || !data.vehicleId) {
      throw 'Please send all parameters in the proper format.'
    }

    // const vehicle = await pool.query('SELECT * FROM vehicle WHERE identifier = ? LIMIT 0,1', [data.vehicleId])
    const vehicleRaw = await redisClient.get(data.type + ':' + data.vehicleId)

    if(!vehicleRaw) {
      throw 'Not found'
    }

    const vehicle = JSON.parse(vehicleRaw)
    const info = await getVehicleItemInfoLeg({ type: data.type, info: vehicle })

    if (data.type === 'train' && info.destination) {
      
      const trips = await pool.query('SELECT * FROM trips WHERE trip_short_name = ? AND trip_headsign = ?', [parseInt(data.vehicleId.replace('train:','')), info.destination])
      if(trips.length === 0) {
        throw 'No trips found'
      }

      // Assumption right here: is the first trip always the right trip? 
      const trip = trips[0]

      const stoptimesRaw = await pool.query('SELECT * FROM stop_times WHERE trip_id = ? ORDER BY stop_sequence ASC', [trip.trip_id])
      const fillFrom = stoptimesRaw.length - info.nextStops.length 

      const transformStoptimes = stoptimesRaw.map(async (stoptime, key) => {
        if (key >= fillFrom) {
          stoptime.has_passed = false
        } else {
          stoptime.has_passed = true
        }

        stoptime.arrival_time = utils.fixTime(stoptime.arrival_time)
        stoptime.departure_time = utils.fixTime(stoptime.departure_time)

        const stop = await pool.query('SELECT * FROM stops WHERE stop_id = ?', [stoptime.stop_id])

        if(!stop.has_passed && info.delay_seconds && info.delay_seconds > 60) {
          stop.new_arrival_time = moment(stoptime.arrival_time, 'HH:mm:ss').add(info.delay_seconds, 'seconds').format('HH:mm:ss') 
          stop.new_departure_time= moment(stoptime.departure_time, 'HH:mm:ss').add(info.delay_seconds, 'seconds').format('HH:mm:ss')
        }

        return _.merge(stoptime, stop)
      })

      trip.stoptimes = await Promise.all(transformStoptimes)
      info.trip = trip
      
    } else {

      const trips = await pool.query('SELECT * FROM trips WHERE realtime_trip_id = ?', [data.vehicleId.replace('vehicle:','')])

      if(trips.length === 0) {
        throw 'No trips found'
      }

      const trip = trips[0]
      info.destination = trip.trip_headsign

      const stoptimesRaw = await pool.query('SELECT * FROM stop_times WHERE trip_id = ? ORDER BY stop_sequence ASC', [trip.trip_id])

      const transformStoptimes = stoptimesRaw.map(async (stoptime, key) => {
        stoptime.arrival_time = utils.fixTime(stoptime.arrival_time)
        stoptime.departure_time = utils.fixTime(stoptime.departure_time)

        const stop = await pool.query('SELECT * FROM stops WHERE stop_id = ?', [stoptime.stop_id])
        // stop.has_passed = info.has_passed
        if(stoptime.stop_sequence < info.nextStop[0].stop_sequence) {
          stop.has_passed = true 
        } else {
          stop.has_passed = false 
        }

        if (!stop.has_passed && info.delay_seconds && info.delay_seconds > 60) {
          stop.new_arrival_time = moment(stoptime.arrival_time, 'HH:mm:ss').add(info.delay_seconds, 'seconds').format('HH:mm:ss') 
          stop.new_departure_time= moment(stoptime.departure_time, 'HH:mm:ss').add(info.delay_seconds, 'seconds').format('HH:mm:ss') 
        } 

        return _.merge(stoptime, stop)
      })

      trip.stoptimes = await Promise.all(transformStoptimes)
      info.trip = trip
    }

    return info 

  } catch(err) {
    Sentry.captureException(err)
    throw err
  }

}

const getStopsWithinRadius = async function({ lat, lon, radius = 300 }) {
  
}

const travelSituationRouter = async ({ vehicleCandidates, matches, userData, client }) => {

  if(vehicleCandidates && matches.vehicle_id) {
    // check if stop is within 200 meter radius 
    const matchedVehicle = _.find(vehicleCandidates, { vehicle_id: matches.vehicle_id })

    const query = `SELECT *, ST_Distance(t.x, S.geom) AS distance 
      FROM (SELECT ST_GeographyFromText('SRID=4326; POINT(${userData.lon} ${userData.lat})')) AS t(x), 
        stops S
      JOIN stop_times ST 
      ON S.stop_id = ST.stop_id 
      WHERE ST_DWithin(t.x, S.geom, 200) 
      AND ST.trip_id = ${matchedVehicle.trip_id}
      ORDER BY distance`

    const { rows: currentTripStops } = await client.query(query)

    if(currentTripStops.length > 0) {
      const currentTripStop = currentTripStops[0]
      currentTripStop.transfers = await getStopTransfers(currentTripStop.stop_id, moment().format('YYYYMMDD'), moment().format('HH:mm:ss'))
      return { responseType: 'stop', response: { stop: currentTripStop } }
    } else {
      return { responseType: 'vehicle', response: { vehicleCandidates: vehicleContext.vehicleCandidates, matches: matches } }
    }
      // if station: 
        // show station 
      
  } else {
    // check if there is a stop within 200m radius
    const query = `SELECT *, ST_Distance(t.x, S.geom) AS distance
    FROM stops S, 
      (SELECT ST_GeographyFromText('SRID=4326; POINT(${userData.lon} ${userData.lat})')) AS t(x) 
    WHERE ST_DWithin(t.x, S.geom, 200) 
    ORDER BY distance
    LIMIT 1
  `
    const { rows: currentStops } = await client.query(query)
    
    if(currentStops.length > 0) {
      const currentStop = currentStops[0]
      currentStop.transfers = await getStopTransfers(currentStop.stop_id, moment().format('YYYYMMDD'), moment().format('HH:mm:ss'))
      return { responseType: 'stop', response: { stop: currentStop } }
    } else {
      const query = `SELECT *, ST_Distance(t.x, S.geom) AS distance 
        FROM stops S, 
          (SELECT ST_GeographyFromText('SRID=4326; POINT(${userData.lon} ${userData.lat})')) AS t(x)  
        WHERE ST_DWithin(t.x, S.geom, 2000) 
        ORDER BY distance 
        LIMIT 5`

      const { rows: stops } = await client.query(query)
      return { responseType: 'nearby', response: { stops: stops } }
    }   
  }
}

module.exports = { 
  getVehicleCandidates: getVehicleCandidates, 
  parseVehicleItemInfo: parseVehicleItemInfo, 
  getVehicleContext: getVehicleContext, 
  travelSituationRouter: travelSituationRouter
}
