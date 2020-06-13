const { pool } = require('./controllers/db.js')
const store = require('./redis-layer-store')
const _ = require('lodash')

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

  radius = 200 // overwrite radius for debugging purposes
  try {
    // const { rows: vehicles } = await client.query(`SELECT trip_id, vehicle_id, 
    //                                                 ST_DistanceSphere('SRID=4326;POINT(${lon} ${lat})', ST_LocateAlong(geom, $1)) AS user_vehicle_distance 
    //                                               FROM trajectories 
    //                                               WHERE start_planned <= $2 
    //                                               AND end_planned >= $3 
    //                                               AND ST_DWithin(ST_LocateAlong(geom, $4)::geography, 'SRID=4326;POINT(${lon} ${lat})::geography', $5, false) 
    //                                               ORDER BY user_vehicle_distance ASC`, [timestamp, timestamp, timestamp, timestamp, radius])

    const { rows: vehicles } = await client.query(`SELECT trip_id, vehicle_id, ST_LocateAlong(geom, $1) as current_vehicle_location
                                                  FROM trajectories 
                                                  WHERE start_planned <= $2 
                                                  AND end_planned >= $3
                                                  LIMIT 5`, [timestamp, timestamp, timestamp])

    
    // for(let i = 0; i < vehicles.length; i++) {
    //   const closestStop = await getVehicleClosestStopDistance(vehicles[i].trip_id, lon, lat)

    //   if(closestStop) {
    //     vehicles[i].closestStopId = closestStop.closest_stop_id
    //     vehicles[i].closestStopDistance = closestStop.closest_stop_distance
    //   }
    // } 

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
 * Returns distance to closest stop in meters for a vehicle. 
 * 
 * @param {int} tripId Trip reference as retrieved from Postgres    
 * @param {float} lon Longitude of vehicle expressed in radians
 * @param {float} lat Latitude of vehicle expressed in radians
 */
async function getVehicleClosestStopDistance(tripId, lon, lat) {

  const client = await pool.connect()

  try {
    const { rows: closestStop } = await client.query(`SELECT MIN(ST_Distance_Sphere('SRID=4326;POINT(${lon} ${lat})', geom)) as closest_stop_distance, 
                                                        stop_id as closest_stop_id 
                                                      FROM stop_times 
                                                      WHERE trip_id = $1
                                                      GROUP BY stop_id 
                                                      ORDER BY closest_stop_distance ASC 
                                                      LIMIT 1`, [tripId])

    if(closestStop.length > 0) {
      return closestStop[0]
    } else {
      return false
    }                                                      
                                                          
  } catch(e) {
    console.log({ msg: 'Could not get vehicle closest stop distance', tripId: tripId, lon: lon, lat: lat, err: e })
    return false
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
    const result = await getVehicleLocationByTime(lon, lat, timestamp, 0.002690)
    // const latestMarkovLayer = await setMarkovLayer(lon, lat, timestamp)
    // const previousMarkovLayers = await getMarkovLayers(userId)

    // const markovLayers = [...previousMarkovLayers ? previousMarkovLayers : [], latestMarkovLayer]

    // const { obs, startProb, emitProb, transProb, states } = await setMarkovModel(markovLayers)

    // let result = false
    // if(markovLayers.length > 1) {
    //   result = await viterbi(obs, states, startProb, transProb, emitProb)
    // }

    // await saveMarkovLayer(latestMarkovLayer, userId)

    return result.length > 0 ? result[result.length - 1] : result
  } catch(err) {
    throw err
  }
  
}

module.exports = { score: score }