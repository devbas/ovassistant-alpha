/*
* Copyright 2019, Bastian Geneugelijk
* 
* 
* Objective: One-on-One test is ran as a baseline test. The expected accuracy is 100%. 
*/ 

const { Client } = require('pg')
const axios = require('axios')
// const async = require('async')
const config = require('../../app/ingestion/config/config')

const testOrganisationId = 'c2dc095a-40f5-41d1-ad7b-55a552018a89'

const scoreOneOnOne = async () => {

  try {
    const client = new Client({...config.pg, host: 'localhost', port: 5434 })
    await client.connect()
    console.log('connected to Postgis!')

    const trajectories = await client.query(`SELECT ST_AsText(geom) as linestring, trip_id, vehicle_id
                                            FROM trajectories
                                            LIMIT 10`)

    for(const index in trajectories.rows) {
      let TP = 0 
      let FP = 0 
      let FN = 0 

      const trajectory = trajectories.rows[index]
      
      const points = trajectory.linestring.substr(trajectory.linestring.lastIndexOf('(') + 1, trajectory.linestring.lastIndexOf(')')).split(',')
      
      const response = await axios.post('http://localhost:8001/api/v1/device/create', { organisationId: testOrganisationId })
      const token = response.data.token
      
      for(const index in points) {
        const point = points[index]
        const pointDetails = point.split(' ')

        const pointResponse = await axios({
          method: 'POST', 
          data: {
            lat: pointDetails[1], 
            lon: pointDetails[0],
            datetime: pointDetails[2] 
          },
          url: 'http://localhost:8001/api/v1/device/score', 
          headers: { 'Authorization': `Bearer ${token}`}
        })
        console.log('pointResponse: ', pointResponse.data)

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