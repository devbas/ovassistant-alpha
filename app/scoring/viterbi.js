const { pool } = require('./controllers/db.js')

/**
 * Returns the probability of the most probable state sequence. 
 * 
 * @param {object} obs The sequence of observations.
 * @param {object} states The set of hidden states. 
 * @param {float} startProb The start probability. 
 * @param {object} transProb Transition matrix with probability for each state to transition to a different state.
 * @param {object} emitProb Emission matrix with probability for each state to stay in this state.
 */

function viterbi(obs, states, startProb, transProb, emitProb) {
  const sequences = [[]]

  // Set initial probabilities
  states.map((state, index) => {
    sequences[0][state] = { prob: startProb[state] * emitProb[state][obs[0]], prev: undefined }
  })

  obs.map((ob, index) => {
    sequences[index + 1] = []
    states.map((state) => {
      let maxTransProb = sequences[index][states[0]]['prob'] * transProb[states[0]][state]
      let prevStateSelected = states[0]
      
      for(let i = 1; i < states.length; i++) {
        const stateTransProb = sequences[index][states[i]]['prob'] * transProb[states[i]][state]
        if(transProb > maxTransProb) {
          maxTransProb = stateTransProb
          prevStateSelected = states[i]
        }
      }

      const maxProb = maxTransProb * emitProb[state][obs[index + 1]]
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
 * Returns list of possible vehicle matches for a list of observations
 * 
 * @param {float} lon Longitude expressed in radians
 * @param {float} lat Latitude expressed in radians
 * @param {integer} timestamp Timestamp expressed in Unix seconds
 */
async function constructMarkovLayer(lon, lat, timestamp) {

}

async function constructMarkovModel(layers) {

}

async function score(lon, lat, timestamp, userId) {

  const latestMarkovLayer = await constructMarkovLayer(lon, lat, timestamp)
  const historicMarkovLayers = await getHistoricMarkovLayers(userId)

  const markovLayers = [...historicMarkovLayers, ...latestMarkovLayer]

  
}


const lon = 4.32384
const lat = 52.081
const timestamp = 1591041240

;(async () => {
  try {
    console.log('go for it')
    const result = await getVehicleLocationByTime(lon, lat, timestamp, 0.002690)
    console.log('result: ', result)
  } catch(err) {
    console.log('err: ', err)
  }
})().catch(err => {
  console.log(err)
})


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