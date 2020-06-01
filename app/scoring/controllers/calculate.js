const Sentry = require('../sentry.js');
const axios = require('axios')
const utils = require('../utils')
const moment = require('moment')
const _ = require('lodash')
const redisClient = require('../redis-client')
const redisLayerStore = require('../redis-layer-store')

const getVehicleCandidates = async (data, pgPool) => { 
  let response = {}

  try {
    console.log('vehicleCandidates', data)
    if(!data.userId || !data.lon || !data.lat || !data.datetime) {
      throw { 'message': 'Make sure to send the longitude, latitude and datetime for an event.', 'status': 500 }
    }

    // Get vehicle candidates from Nearest   
    const vehicleCandidatesRaw = await axios.get(`http://nearest:9002/classify/location?lon=${data.lon}&lat=${data.lat}&datetime=${data.datetime}&user_id=${data.userId}`)
                                              .catch(err => {
                                                Sentry.captureException(err)
                                                throw { 'message': 'Something went wrong on our end. Please try again later.', 'status': 500 }
                                              })
    console.log('raw: ', vehicleCandidatesRaw.data.observations)
    // const vehicleData = JSON.parse(vehicleCandidatesRaw.data)
    let vehicleCandidates = vehicleCandidatesRaw.data.observations ? vehicleCandidatesRaw.data.observations : false 
    // let vehicleCandidates = JSON.parse(vehicleCandidatesRaw.data.observations)
    const matches = vehicleCandidatesRaw.data.matches

    if(!_.isEmpty(vehicleCandidates) && vehicleCandidates.length > 0) {
      vehicleCandidates = JSON.parse(vehicleCandidates)
      
      vehicleCandidates = await Promise.all(vehicleCandidates.map(getVehicleItemInfo.bind(null, pgPool)))
      const userLayersRaw = await redisLayerStore.get(data.userId)

      if(userLayersRaw === null && vehicleCandidates.length > 0) {
        await redisLayerStore.set(data.userId, JSON.stringify([vehicleCandidates]))
      } else if(vehicleCandidates.length > 0) {
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
        pgPool: pgPool, 
        datetime: data.datetime
      })

      response.responseType = situation.responseType
      response.response = situation.response
    }
    
    return response
  } catch(err) {
    Sentry.captureException(err)
    console.log('err: ', err)
  }

}

const getVehicleItemInfo = async (pgPool, vehicle) => {
  try {

    vehicle.destination = false 
    vehicle.title_prefix = false  
  
    const trip = await pgPool.query('SELECT trip_headsign, route_id, trip_id FROM trips WHERE realtime_trip_id = $1 LIMIT 1', [vehicle.vehicle_id])

    if(!trip[0] || !trip[0].trip_headsign) {
      return vehicle 
    }

    vehicle.destination = trip[0].trip_headsign 
    vehicle.trip_id = trip[0].trip_id 

    const tripRouteName = await pgPool.query('SELECT route_short_name FROM routes WHERE route_id = $1 LIMIT 1', [trip[0].route_id])

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

const getStopTransfers = async ({ stopId, date, time, pgPool, nested }) => {

  const timeLimit = moment(time, 'HH:mm:ss').add(1, 'hours').format('HH:mm:ss')
   
  const { rows: parentStop } = await pgPool.query('SELECT parent_station FROM stops WHERE stop_id = $1 LIMIT 1', [stopId])
  
  if(parentStop[0] && parentStop[0].parent_station) {
    var { rows: transfersRaw } = await pgPool.query(`SELECT * 
      FROM stop_times ST 
      JOIN trips T 
      ON ST.trip_id = T.trip_id 
      INNER JOIN calendar_dates CD 
      ON T.service_id = CD.service_id 
      JOIN stops S 
      ON S.stop_id = ST.stop_id 
      WHERE S.parent_station = $1
      AND ST.departure_time > $2
      AND ST.departure_time < $3
      AND CD.date = $4
      AND pickup_type = 0
      ORDER BY departure_time ASC
      LIMIT 10`, [parentStop[0].parent_station, time, timeLimit, date])
  } else {
    var { rows: transfersRaw } = await pgPool.query(`SELECT * 
      FROM stop_times ST 
      JOIN trips T 
      ON ST.trip_id = T.trip_id 
      INNER JOIN calendar_dates CD 
      ON T.service_id = CD.service_id 
      JOIN stops S 
      ON S.stop_id = ST.stop_id 
      WHERE ST.stop_id = $1
      AND ST.departure_time > $2
      AND ST.departure_time < $3
      AND CD.date = $4
      AND pickup_type = 0
      ORDER BY departure_time ASC
      LIMIT 10`, [stopId, time, timeLimit, date])
  }
                                         
  const transfers = _.map(transfersRaw, async (transfer) => {
    transfer.arrival_time = utils.fixTime(transfer.arrival_time)
    transfer.departure_time = utils.fixTime(transfer.departure_time)
    const { rows: route } = await pgPool.query('SELECT * FROM routes WHERE route_id = $1', [transfer.route_id])
    transfer.route = route[0] ? route[0] : {}
    transfer.stoptimes = await getStoptimes({
      tripId: transfer.trip_id, 
      pgPool: pgPool, 
      timetableTime: time, 
      timetableDate: date, 
      nested: nested 
    })

    return transfer 
  })         

  return await Promise.all(transfers)
}

const getStoptimes = async ({ tripId, pgPool, timetableTime, timetableDate, nested }) => {
  const { rows: stoptimes } = await pgPool.query('SELECT * FROM stop_times WHERE trip_id = $1 ORDER BY stop_sequence ASC', [tripId])

  const upcomingStoptimes = _.map(stoptimes, async (stoptime, key) => {

    stoptime.arrival_time = utils.fixTime(stoptime.arrival_time)
    stoptime.departure_time = utils.fixTime(stoptime.departure_time)
    stoptime.has_passed = false // TODO: implement contextual value based on current vehicle location. 

    if(!stoptime.has_passed && !nested) { // TODO: find out whether and how getStopTransfers and getStoptimes can cause infinite loop. If yes, apply !nested 
      stoptime.transfers = await getStopTransfers({
        stopId: stoptime.stop_id, 
        date: timetableDate, 
        time: timetableTime, 
        pgPool: pgPool,
        nested: true
      })

      const { rows: stop } = await pgPool.query('SELECT * FROM stops WHERE stop_id = $1', [stoptime.stop_id])
      return _.merge(stoptime, stop[0])
    } else {
      return stoptime
    }
  })

  return await Promise.all(upcomingStoptimes)
}

// const parseVehicleItemInfo = async function(data) {

//   try {

//     if(!data || !data.type || !data.vehicleId) {
//       throw 'Please send all parameters in the proper format.'
//     }

//     const vehicleRaw = await redisClient.get(data.type + ':' + data.vehicleId)

//     if(!vehicleRaw) {
//       throw 'Not found'
//     }

//     const vehicle = JSON.parse(vehicleRaw)
//     const info = await getVehicleItemInfoLeg({ type: data.type, info: vehicle })

//     if (data.type === 'train' && info.destination) {
      
//       const trips = await pool.query('SELECT * FROM trips WHERE trip_short_name = ? AND trip_headsign = ?', [parseInt(data.vehicleId.replace('train:','')), info.destination])
//       if(trips.length === 0) {
//         throw 'No trips found'
//       }

//       // Assumption right here: is the first trip always the right trip? 
//       const trip = trips[0]

//       const stoptimesRaw = await pool.query('SELECT * FROM stop_times WHERE trip_id = ? ORDER BY stop_sequence ASC', [trip.trip_id])
//       const fillFrom = stoptimesRaw.length - info.nextStops.length 

//       const transformStoptimes = stoptimesRaw.map(async (stoptime, key) => {
//         if (key >= fillFrom) {
//           stoptime.has_passed = false
//         } else {
//           stoptime.has_passed = true
//         }

//         stoptime.arrival_time = utils.fixTime(stoptime.arrival_time)
//         stoptime.departure_time = utils.fixTime(stoptime.departure_time)

//         const stop = await pool.query('SELECT * FROM stops WHERE stop_id = ?', [stoptime.stop_id])

//         if(!stop.has_passed && info.delay_seconds && info.delay_seconds > 60) {
//           stop.new_arrival_time = moment(stoptime.arrival_time, 'HH:mm:ss').add(info.delay_seconds, 'seconds').format('HH:mm:ss') 
//           stop.new_departure_time= moment(stoptime.departure_time, 'HH:mm:ss').add(info.delay_seconds, 'seconds').format('HH:mm:ss')
//         }

//         return _.merge(stoptime, stop)
//       })

//       trip.stoptimes = await Promise.all(transformStoptimes)
//       info.trip = trip
      
//     } else {

//       const trips = await pool.query('SELECT * FROM trips WHERE realtime_trip_id = ?', [data.vehicleId.replace('vehicle:','')])

//       if(trips.length === 0) {
//         throw 'No trips found'
//       }

//       const trip = trips[0]
//       info.destination = trip.trip_headsign

//       const stoptimesRaw = await pool.query('SELECT * FROM stop_times WHERE trip_id = ? ORDER BY stop_sequence ASC', [trip.trip_id])

//       const transformStoptimes = stoptimesRaw.map(async (stoptime, key) => {
//         stoptime.arrival_time = utils.fixTime(stoptime.arrival_time)
//         stoptime.departure_time = utils.fixTime(stoptime.departure_time)

//         const stop = await pool.query('SELECT * FROM stops WHERE stop_id = ?', [stoptime.stop_id])
//         // stop.has_passed = info.has_passed
//         if(stoptime.stop_sequence < info.nextStop[0].stop_sequence) {
//           stop.has_passed = true 
//         } else {
//           stop.has_passed = false 
//         }

//         if (!stop.has_passed && info.delay_seconds && info.delay_seconds > 60) {
//           stop.new_arrival_time = moment(stoptime.arrival_time, 'HH:mm:ss').add(info.delay_seconds, 'seconds').format('HH:mm:ss') 
//           stop.new_departure_time= moment(stoptime.departure_time, 'HH:mm:ss').add(info.delay_seconds, 'seconds').format('HH:mm:ss') 
//         } 

//         return _.merge(stoptime, stop)
//       })

//       trip.stoptimes = await Promise.all(transformStoptimes)
//       info.trip = trip
//     }

//     return info 

//   } catch(err) {
//     Sentry.captureException(err)
//     throw err
//   }

// }

const travelSituationRouter = async ({ vehicleCandidates, matches, userData, pgPool, datetime }) => {

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

    const { rows: currentTripStops } = await pgPool.query(query)

    if(currentTripStops.length > 0) {
      const currentTripStop = currentTripStops[0]
      currentTripStop.transfers = await getStopTransfers({
        stopId: currentTripStop.stop_id, 
        date: moment().format('YYYYMMDD'), 
        time: moment().format('HH:mm:ss'), 
        pgPool: pgPool, 
        nested: false 
      })
      return { responseType: 'stop', response: { stop: currentTripStop } }
    } else {
      return { responseType: 'vehicle', response: { vehicleCandidates: vehicleContext.vehicleCandidates, matches: matches } }
    }
      // if station: 
        // show station 
      
  } else {
    // check if there is a stop within 150m radius
    const query = `SELECT *, ST_Distance(t.x, S.geom) AS distance
    FROM stops S, 
      (SELECT ST_GeographyFromText('SRID=4326; POINT(${userData.lon} ${userData.lat})')) AS t(x) 
    WHERE ST_DWithin(t.x, S.geom, 150) 
    ORDER BY distance
    LIMIT 1`

    const { rows: currentStops } = await pgPool.query(query)
    
    if(currentStops.length > 0) {
      const currentStop = currentStops[0]
      currentStop.transfers = await getStopTransfers({
        stopId: currentStop.stop_id, 
        date: moment().format('YYYYMMDD'), 
        time: moment().format('HH:mm:ss'), 
        pgPool: pgPool, 
        nested: false
      })
      return { responseType: 'stop', response: { stop: currentStop } }
    } else {
      const query = `SELECT *, ST_Distance(t.x, S.geom) AS distance 
        FROM stops S, 
          (SELECT ST_GeographyFromText('SRID=4326; POINT(${userData.lon} ${userData.lat})')) AS t(x)  
        WHERE ST_DWithin(t.x, S.geom, 2000) 
        ORDER BY distance 
        LIMIT 5`

      const { rows: stops } = await pgPool.query(query)

      // Create date from datetime 
      // Create time from datetime
      const date = moment.unix(datetime).format('YYYYMMDD')
      const time = moment.unix(datetime).format('HH:mm:ss')

      const stopsTimetable = stops.map(stop => Object.assign({ 
        timetable: getStopTransfers({ 
            stopId: stop.stop_id, 
            date: date, 
            time: time,
            pgPool: pgPool, 
            nested: false
          }) 
        }, stop
      ))

      return { responseType: 'nearby', response: { stops: stopsTimetable } }
    }   
  }
}

module.exports = { 
  getVehicleCandidates: getVehicleCandidates, 
  // parseVehicleItemInfo: parseVehicleItemInfo, 
  // getVehicleContext: getVehicleContext, 
  travelSituationRouter: travelSituationRouter
}
