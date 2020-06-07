const { pool } = require('./controllers/db.js')
const store = require('./redis-layer-store')
const util = require('util')

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
  const sequences = [[]]

  console.log(util.inspect( transProb ))

  // Set initial probabilities
  states.map((state, index) => {
    sequences[0][state] = { prob: startProb[state] * emitProb[0][state], prev: undefined }
  })

  obs = obs.slice(1)
  obs.map((ob, index) => { // Loop over all measurements 
    sequences[index + 1] = []
    states.map((state) => { // Loop over all vehicles
      let maxTransProb = sequences[index][states[0]]['prob'] * transProb[index][states[0]][state] // Set initial max transition probability
      let prevStateSelected = states[0]
      
      for(let i = 1; i < states.length; i++) { // Determine transition probability from vehicle to each vehicle
        const stateTransProb = sequences[index][states[i]]['prob'] * transProb[index][states[i]][state] // startProb * 
        if(transProb > maxTransProb) {
          maxTransProb = stateTransProb
          prevStateSelected = states[i]
        }
      }

      const maxProb = maxTransProb * emitProb[index][state][obs[index + 1]]
      sequences[index + 1][state] = { prob: maxProb, prev: prevStateSelected }
    })
  })

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

  try {
    const { rows: vehicles } = await client.query(`SELECT trip_id, vehicle_id, 
                                                    ST_DistanceSphere('SRID=4326;POINT(${lon} ${lat})', ST_LocateAlong(geom, $1)) AS user_vehicle_distance 
                                                  FROM tmp_trajectories 
                                                  WHERE start_planned <= $2 
                                                  AND end_planned >= $3 
                                                  AND ST_DWithin(ST_LocateAlong(geom, $4), 'SRID=4326;POINT(${lon} ${lat})', $5) 
                                                  ORDER BY user_vehicle_distance ASC`, [timestamp, timestamp, timestamp, timestamp, radius])

    
    for(let i = 0; i < vehicles.length; i++) {
      const closestStop = await getVehicleClosestStopDistance(vehicles[i].trip_id, lon, lat)

      if(closestStop) {
        vehicles[i].closestStopId = closestStop.closest_stop_id
        vehicles[i].closestStopDistance = closestStop.closest_stop_distance
      }
    } 

    return vehicles
  } catch(e) {
    console.log({ msg: 'Could not get vehicle location by time', lon: lon, lat: lat, timestamp: timestamp, radius: radius })
    return false
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
                                                      FROM tmp_stop_times 
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

  const observations = await getVehicleLocationByTime(lon, lat, timestamp, 0.002690);

  GPSErrorMargin = 4.07 // Derived from Newson et al. Potential tuning parameter
  for(let i = 0; i < observations.length; i++) {
    observations[i].emissionProb = (10 / (Math.sqrt(2 * Math.PI) * GPSErrorMargin)) * Math.exp(-0.5 * (observations[i].user_vehicle_distance / GPSErrorMargin)**2)
    observations[i].transitionProb = await calculateTransitionMatrix(observations[i], observations)
  }

  return observations
}

async function setMarkovModel(layers) {
  const emitProb = []
  const startProb = {}
  const transProb = []
  const states = []
  
  for(let i = 0; i < layers.length; i++) {
    const layer = layers[i]

    if(i > 0) {
      emitProb.push({})
      transProb.push({})
    }

    for(let j = 0; j < layer.length; j++) {
      const vehicle = layer[j]

      if(!states.includes(vehicle.vehicle_id)) {
        states.push(vehicle.vehicle_id)
      }

      if(i === 0) {
        startProb[vehicle.vehicle_id] = vehicle.emissionProb
      } else {
        emitProb[i - 1][vehicle.vehicle_id] = vehicle.emissionProb
        transProb[i - 1][vehicle.vehicle_id] = vehicle.transitionProb[vehicle.vehicle_id]
      }
    }
  }

  // Fill missing vehicles in observations with zero
  for(const key in states) {
    const state = states[key]
    for(let i = 0; i < layers.length - 1; i++) {
      if(!(state in emitProb[i])) {

        let prob = {}
        for(let j = 0; j < states.length; j++) {
          if(states[j] === state) {
            prob[states[j]] = 1 
          } else {
            prob[states[j]] = 0
          }
        }

        emitProb[i][state] = prob
      }

      if(!(state in transProb[i])) {

        let prob = {}
        for(let j = 0; j < states.length; j++) {
          if(states[j] === state) {
            prob[states[j]] = 1 
          } else {
            prob[states[j]] = 0
          }
        }

        transProb[i][state] = prob
      }
    }
  }

  return { startProb: startProb, emitProb: emitProb, transProb: transProb, states: states }
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

  const latestMarkovLayer = await setMarkovLayer(lon, lat, timestamp)
  const previousMarkovLayers = await getMarkovLayers(userId)

  const markovLayers = [...previousMarkovLayers ? previousMarkovLayers : [], latestMarkovLayer]

  const { startProb, emitProb, transProb, states } = await setMarkovModel(markovLayers)

  let result = false
  if(markovLayers.length > 1) {
    result = await viterbi(markovLayers, states, startProb, transProb, emitProb)
  }

  await saveMarkovLayer(latestMarkovLayer, userId)

  return result
  
}


const data = [
  {
    lon: 4.93199, 
    lat: 52.40252,
    timestamp: 1590954480
  }, {
    lon: 4.93501, 
    lat: 52.40255,
    timestamp: 1590954498
  }, {
    lon: 4.93552, 
    lat: 52.40296,
    timestamp: 1590954501
  }
  // }, {
  //   lon: 4.93591, 
  //   lat: 52.40337,
  //   timestamp: 1590954505
  // }, {
  //   lon: 4.93604, 
  //   lat: 52.40354,
  //   timestamp: 1590954506
  // }, {
  //   lon: 4.9361, 
  //   lat: 52.40372,
  //   timestamp: 1590954507
  // }, {
  //   lon: 4.93599, 
  //   lat: 52.40401,
  //   timestamp: 1590954509
  // }
]

;(async () => {
  try {

    let outcome = []
    const userId = Math.random()
    for(let i = 0; i < data.length; i++) {
      const observation = data[i]
      const result = await score(observation.lon, observation.lat, observation.timestamp, userId)
      console.log(util.inspect({ result: result, userId: userId }, {showHidden: false, depth: null}))
      console.log('================================================================')
      outcome.push(result)
    }

    
  } catch(err) {
    console.log('err: ', err)
  }
})().catch(err => {
  console.log(err)
})

// const obs = [1, 2, 3, 4]
// const states = ['Groningen', 'Den Haag', 'Enschede']
// const startProb = { 'Groningen': 1, 'Den Haag': 2, 'Enschede': 3 }
// const transProb = { 
//  'Groningen':
// }


// const obs = ['normal', 'cold', 'dizzy']
// const states = ['Healthy', 'Fever']
// const startProb = { 'Healthy': 0.6, 'Fever': 0.4 }
// const transProb = { 
//   'Healthy': { 'Healthy': 0.7, 'Fever': 0.3 }, 
//   'Fever': { 'Healthy': 0.4, 'Fever': 0.6 }
// }
// const emitProb = {
//   'Healthy': { 'normal': 0.5, 'cold': 0.4, 'dizzy': 0.1 }, 
//   'Fever': { 'normal': 0.1, 'cold': 0.3, 'dizzy': 0.6 }
// }

// console.log(viterbi(obs, states, startProb, transProb, emitProb))