const { pool } = require('./controllers/db.js')
const store = require('./redis-layer-store')
const _ = require('lodash')
const {performance} = require('perf_hooks');

async function refreshActiveVehicleCache() { 
  console.log('refreshing active cache');  

  try {
    const client = await pool.connect()

    console.log('client leased from pool');  

    await client.query('BEGIN')

    const currentUnix = Math.floor(Date.now() / 1000)

    // Copy from passive table into active table
    await client.query({ text: `INSERT INTO trip_times_active(triptime_id, shapeline_id, trip_id, start_planned, end_planned, is_active)
                                SELECT triptime_id, shapeline_id, trip_id, start_planned, end_planned, 1 as is_active
                                FROM trip_times_passive
                                WHERE start_planned <= $1
                                AND end_planned >= $2
                                AND end_planned != start_planned`, values: [currentUnix, currentUnix] })

    // Delete from passive table
    await client.query({ text: `DELETE FROM trip_times_passive
                                WHERE start_planned <= $1 
                                AND end_planned >= $2
                                AND end_planned != start_planned`, values: [currentUnix, currentUnix] })

    // Copy from active table into passive table
    await client.query({ text: `INSERT INTO trip_times_passive(triptime_id, shapeline_id, trip_id, start_planned, end_planned, is_active) 
                                SELECT triptime_id, shapeline_id, trip_id, start_planned, end_planned, 0 as is_active 
                                FROM trip_times_active 
                                WHERE end_planned < $1 
                                AND end_planned != start_planned`, values: [currentUnix] })

    // Delete from active table
    await client.query({ text: `DELETE FROM trip_times_active 
                                WHERE end_planned < $1 
                                AND end_planned != start_planned; `, values: [currentUnix] })
    
    await client.query('COMMIT')

    console.log(`done for ${currentUnix}`)
    client.release()
  } catch(err) {
    console.log('err: ', err)
  }

  setTimeout(refreshActiveVehicleCache, 10000)
}

refreshActiveVehicleCache()

/**
 * Returns the probability of the most probable state sequence. 
 * 
 * @param {object} obs The sequence of observations.
 * @param {object} states The set of hidden states. 
 * @param {float} startProb The start probability. 
 * @param {array} transProb Transition matrix with probability for each state to transition to a different state.
 * @param {object} emitProb Emission matrix with probability for each state to stay in this state.
 */
function viterbi(obs, states, startProb, transProb, emitProb) {

  const sequences = []
  sequences[0] = {}

  states.map(state => {
    sequences[0][state] = { prob: startProb[state] * emitProb[state][obs[0]], prev: undefined }
  })

  obs.map((ob, index) => { // Loop over all measurements 
    if(index > 0) {
      sequences[index] = {}

      states.map((state, stateIndex) => {
        let maxTransProb = sequences[index - 1][states[0]]['prob'] * transProb[states[0]][state]
        let prevStateSelected = states[0]

        states.map((prevState, prevStateIndex) => {
          if(prevStateIndex > 0) {
            const stateTransProb = sequences[index - 1][prevState]['prob'] * transProb[prevState][state]
            if(stateTransProb > maxTransProb) {
              maxTransProb = stateTransProb
              prevStateSelected = prevState
            }
          }
        })

        const maxProb = maxTransProb * emitProb[state][obs[index]]
        sequences[index][state] = { prob: maxProb, prev: prevStateSelected }
      })
    }    
  })

  const opt = []
  let maxProb = 0
  let previous = undefined

  for (let [key, value] of Object.entries(sequences[sequences.length - 1])) {
    if(value.prob > maxProb) {
      maxProb = value.prob
      opt.push(key)
      previous = key
    }
  }

  return sequences
}


/**
 * Returns vehicles within a given radius (meters) for a given timestamp. 
 * 
 * @param {float} lon Longitude expressed in radians
 * @param {float} lat Latitude expressed in radians
 * @param {int} timestamp Timestamp expressed in UNIX Seconds
 */
async function getVehicleLocationByTime(lon, lat, timestamp, radius) {
  
  const client = await pool.connect()

  /* SELECT *, ST_AsEWKT(ST_Line_Interpolate_Point(S.geom, (1593351708 - start_planned) / (end_planned - start_planned) ))
FROM tmp_trip_times TT
JOIN tmp_shapelines S 
ON TT.shapeline_id = S.shapeline_id
WHERE TT.start_planned <= 1593351708 
AND TT.end_planned >= 1593351708
AND TT.end_planned != TT.start_planned */


  try {
    var t0 = performance.now()

    const { rows: vehicles } = await client.query(`SELECT *,
                                                  (
                                                    SELECT MIN(ST_Distance_Sphere('SRID=4326;POINT(${lon} ${lat})', geom)) AS closestStopDistance
                                                    FROM stop_times ST
                                                    WHERE ST.trip_id = TT.trip_id 
                                                    GROUP BY stop_id, trip_id 
                                                    LIMIT 1
                                                  ) AS closestStopDistance,
                                                  (
                                                    SELECT stop_id
                                                    FROM stop_times ST
                                                    WHERE ST.trip_id = TT.trip_id 
                                                    ORDER BY ST_Distance_Sphere('SRID=4326;POINT(${lon} ${lat})', geom) ASC
                                                    LIMIT 1
                                                  ) AS closestStopId, 
                                                  ST_DistanceSphere(
                                                    'SRID=4326;POINT(${lon} ${lat})', 
                                                    ST_Line_Interpolate_Point(
                                                      S.geom, 
                                                      ($1 - start_planned) / (end_planned - start_planned) 
                                                    )
                                                  ) AS user_vehicle_distance
                                                  FROM trip_times_active TT
                                                  JOIN shapelines S 
                                                  ON TT.shapeline_id = S.shapeline_id
                                                  WHERE TT.start_planned <= $2 
                                                  AND TT.end_planned >= $3
                                                  AND TT.end_planned != TT.start_planned
                                                  AND ST_DWithin(
                                                    ST_Line_Interpolate_Point(
                                                      S.geom, 
                                                      ($4 - start_planned) / (end_planned - start_planned) 
                                                    ), 
                                                    'SRID=4326;POINT(${lon} ${lat})', 
                                                    1000, 
                                                    False
                                                  )`, [timestamp, timestamp, timestamp, timestamp])

    // const { rows: vehicles } = await client.query(`SELECT trip_id, vehicle_id, 
    //                                                 ST_DistanceSphere('SRID=4326;POINT(${lon} ${lat})', ST_LocateAlong(geom, $1)) AS user_vehicle_distance, 
    //                                                 (
    //                                                   SELECT MIN(ST_Distance_Sphere('SRID=4326;POINT(${lon} ${lat})', geom)) AS closestStopDistance
    //                                                   FROM stop_times ST
    //                                                   WHERE ST.trip_id = T.trip_id 
    //                                                   GROUP BY stop_id, trip_id 
    //                                                   LIMIT 1
    //                                                 ) AS closestStopDistance, 
    //                                                 (
    //                                                   SELECT stop_id
    //                                                   FROM stop_times ST
    //                                                   WHERE ST.trip_id = T.trip_id 
    //                                                   ORDER BY ST_Distance_Sphere('SRID=4326;POINT(${lon} ${lat})', geom) ASC
    //                                                   LIMIT 1
    //                                                 ) AS closestStopId 
    //                                               FROM trajectories T
    //                                               WHERE geom &&& ST_Collect(
    //                                                 ST_MakePointM(${lon}, ${lat}, $2),
    //                                                 ST_MakePointM(${lon}, ${lat}, $3)
    //                                               )
    //                                               AND start_planned <= $4 
    //                                               AND end_planned >= $5
    //                                               GROUP BY geom, trip_id, vehicle_id
    //                                               ORDER BY user_vehicle_distance ASC
    //                                               LIMIT 7`, [timestamp, timestamp, timestamp, timestamp, timestamp])
    
    var t1 = performance.now()                                                
    console.log(`Database call took ${(t1 - t0)} milliseconds for lon: ${lon}, lat: ${lat}, timestamp: ${timestamp}`)
    return vehicles
    // return []
  } catch(e) {
    console.log({ msg: 'Could not get vehicle location by time', lon: lon, lat: lat, timestamp: timestamp, radius: radius })
    throw e
  } finally {
    client.release()
  }
}

/**
 * Returns the probability of a transition between a prior and posterior vehicle.
 * 
 * @param {Object} candidate Prior vehicle to calculate from
 * @param {Object} vehicle Posterior vehicle 
 */
function calculateTransition(candidate, vehicle) {
  
  const stdGPSMeasurement = 4.07 // Tuning parameter 
  const nonDirectTolerance = 6.2831 * stdGPSMeasurement

  const distance = candidate.closestStopDistance + vehicle.closestStopDistance

  return (1 / nonDirectTolerance) * Math.exp(-distance / nonDirectTolerance)
}

/**
 * Returns a 
 * 
 * @param {Object} candidate 
 * @param {Array} fleet 
 */
async function calculateTransitionMatrix(candidate, fleet) { 

  const transitionProb = {}
  for(let i = 0; i < fleet.length; i++) {
    const vehicle = fleet[i]

    if(candidate.vehicle_id === vehicle.vehicle_id) {
      transitionProb[vehicle.vehicle_id] = 1
    } else {
      transitionProb[vehicle.vehicle_id] = calculateTransition(candidate, vehicle)
    }
  }

  return { [candidate.vehicle_id]: transitionProb }
}

/**
 * Returns list of possible vehicle matches for a list of observations
 * 
 * @param {float} lon Longitude expressed in radians
 * @param {float} lat Latitude expressed in radians
 * @param {integer} timestamp Timestamp expressed in Unix seconds
 */
async function setMarkovLayer(lon, lat, timestamp) {

  try {
    const observations = await getVehicleLocationByTime(lon, lat, timestamp, 0.002690);
    console.log('amount of observations: ', observations.length);
    GPSErrorMargin = 4.07 // Derived from Newson et al. Potential tuning parameter
    for(let i = 0; i < observations.length; i++) {
      observations[i].emissionProb = (10 / (Math.sqrt(2 * Math.PI) * GPSErrorMargin)) * Math.exp(-0.5 * (observations[i].user_vehicle_distance / GPSErrorMargin)**2)
      observations[i].transitionProb = await calculateTransitionMatrix(observations[i], observations)
    }

    return observations
  } catch(err) {
    throw err
  }
}

function createObservationId(length = 15) { 
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return `obs_${text}`;
}

async function setMarkovModel(layers) {
  const emitProb = {}
  const startProb = {}
  const transProb = []
  const states = []
  const obs = []

  for(let i = 0; i < layers.length; i++) {
    const observationId = createObservationId()
    obs.push(observationId)
    
    layers[i].observationId = observationId

    const layer = layers[i]

    for(let j = 0; j < layer.length; j++) {
      const vehicle = layer[j]
      if(!states.includes(vehicle.vehicle_id)) {
        states.push(vehicle.vehicle_id)
        startProb[vehicle.vehicle_id] = vehicle.emissionProb
      }
    }
  }

  for(const index in states) {
    const state = states[index]
    emitProb[state] = {}
    transProb[state] = {}

    for(let i = 0; i < layers.length; i++) {
      const layer = layers[i]
      const vehicle = _.find(layer, { vehicle_id: state })
      emitProb[state][layer.observationId] = vehicle ? vehicle.emissionProb : 0

      for(let j = 0; j < layer.length; j++) {
        const vehicle = layer[j]
        const transitionProb = vehicle.transitionProb[vehicle.vehicle_id][state]
        transProb[state][vehicle.vehicle_id] = transitionProb ? transitionProb : 0
      }
    }
  }

  return { obs: obs, startProb: startProb, emitProb: emitProb, transProb: transProb, states: states }
}

async function getMarkovLayers(userId) {
  const userLayers = await store.get(userId)

  return JSON.parse(userLayers)
}

async function saveMarkovLayer(layer, userId) {
  const userLayers = await store.get(userId)

  if(userLayers === null) {
    await store.set(userId, JSON.stringify([layer]))
  } else {
    let updatedLayers = JSON.parse(userLayers)
    updatedLayers = updatedLayers.slice(-1 * 4)
    updatedLayers.push(layer)
    
    await store.set(userId, JSON.stringify(updatedLayers))
  }
}

async function score(lon, lat, timestamp, userId) {
  try {
    const latestMarkovLayer = await setMarkovLayer(lon, lat, timestamp)
    const previousMarkovLayers = await getMarkovLayers(userId)

    const markovLayers = [...previousMarkovLayers ? previousMarkovLayers : [], latestMarkovLayer]

    const { obs, startProb, emitProb, transProb, states } = await setMarkovModel(markovLayers)

    let result = false
    if(markovLayers.length > 1) {
      result = await viterbi(obs, states, startProb, transProb, emitProb)
    }

    await saveMarkovLayer(latestMarkovLayer, userId)

    return result.length > 0 ? result[result.length - 1] : result
  } catch(err) {
    throw err
  }
  
}

module.exports = { score: score }