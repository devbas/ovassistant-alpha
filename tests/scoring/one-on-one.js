/*
* Copyright 2019, Bastian Geneugelijk
* 
* 
* Objective: One-on-One test is ran as a baseline test. The expected accuracy is 100%. 
*/ 

const { Client } = require('pg')
const axios = require('axios')
const config = require('../../app/ingestion/config/config')
const util = require('util')

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const scoreOneOnOne = async () => {

  try {
    const client = new Client({...config.pg, host: 'localhost', port: 5434 })
    await client.connect()
    console.log('connected to Postgis!')

    const trajectories = await client.query(`SELECT ST_AsText(geom) as linestring, trip_id, vehicle_id
                                            FROM trajectories
                                            LIMIT 10`)

    for(const index in trajectories.rows) {
      console.log(`trajectory ${index}`)
      let TP = 0 
      let FP = 0 
      let FN = 0 

      const trajectory = trajectories.rows[index]
      const userId = uuidv4()
      
      const points = trajectory.linestring.substr(trajectory.linestring.lastIndexOf('(') + 1, trajectory.linestring.lastIndexOf(')')).split(',')
      
      for(const index in points) {
        const point = points[index]
        const pointDetails = point.split(' ')

        const pointResponse = await axios({
          method: 'POST', 
          data: {
            lat: pointDetails[1], 
            lon: pointDetails[0],
            datetime: pointDetails[2], 
            userId: userId
          },
          url: 'http://localhost:8001/api/v1/device/score',
          headers: { 'X-Transaction-ID': uuidv4() }
        })
        console.log('pointResponse: ', util.inspect(pointResponse.data, false, null, true))

        if(pointResponse.data.matches) {
          if(pointResponse.data.matches.vehicle_id === trajectory.vehicle_id) {
            TP = TP + 1
          } else {
            FP = FP + 1
          }
        } else {
          FN = FN + 1
        }
      }
      
      console.log('for ', trajectory.vehicle_id, ' TP:', TP, ' FP:', FP, ' FN:', FN)

    }
  } catch(e) {
    console.log('e: ', e)
  }

}

scoreOneOnOne() 