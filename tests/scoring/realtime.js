/* 
* Copyright 2019, Bastian Geneugelijk
* 
* 
* Objective: Realtime test is ran on provided testdata from the GTFS-RT pubsub feed. 
*/
const fs = require('fs')
// const parse = require('csv-parse')
const csv = require('fast-csv')
const axios = require('axios')

const config = require('../../app/ingestion/config/config')

const testOrganisationId = 'c2dc095a-40f5-41d1-ad7b-55a552018a89'
let deviceTokens = {}

let TP = 0 
let FP = 0 
let FN = 0 

const realtimeTest = () => { 

  try {
    let stream = fs.createReadStream('../../app/ingestion/realtime2.csv')
      .pipe(csv.parse({delimiter: ','}))
      .on('data', async (csvRow) => {
        stream.pause() 

        try {
          const [vehicleType, vehicleId] = csvRow[0].split(/:(.+)/)
          let token = undefined

          if(!deviceTokens[vehicleId]) {
            const tokenResponse = await axios.post('http://localhost:8001/api/v1/device/create', { organisationId: testOrganisationId })
            const deviceToken = { 
              [vehicleId]: {
                vehicleType: vehicleType, 
                token: tokenResponse.data.token
              }
            }
            
            deviceTokens = {...deviceTokens, ...deviceToken}
            // process.exit()
            token = deviceTokens[vehicleId].token
          } else {
            token = deviceTokens[vehicleId].token
          }
          
          let datetime = parseInt(csvRow[1]) + 7200
          // console.log('datetime: ', datetime)
          const pointResponse = await axios({
            method: 'POST', 
            data: {
              lat: csvRow[2], 
              lon: csvRow[3],
              datetime: datetime
            },
            url: 'http://localhost:8001/api/v1/device/score', 
            headers: { 'Authorization': `Bearer ${token}`}
          })

          console.log('resonse: ', pointResponse.data)
          
          if(pointResponse.data.matches && pointResponse.data.matches.vehicle_id) {
            let responseVehicleId = false 

            if(deviceTokens[vehicleId].vehicleType === 'train') {
              responseVehicleId = pointResponse.data.matches.vehicle_id.substring(pointResponse.data.matches.vehicle_id.lastIndexOf(':') + 1)   
            } else {
              responseVehicleId = pointResponse.data.matches.vehicle_id
            }

            console.log(responseVehicleId, vehicleId)

            if(responseVehicleId === vehicleId) {
              TP = TP + 1
            } else {
              FP = FP + 1
              console.log('response: ', pointResponse.data, csvRow)
              // process.exit()
            }
            
          } else {
            FN = FN + 1
          }
          stream.resume()
        } catch(e) {
          console.log('e2: ', e)
          process.exit()
        }

        // if(deviceTokens[])
        
      })
      .on('end',function() {
        //do something wiht csvData
        // console.log(csvData); 
      });
  } catch(e) {
    console.log('e', e)
  }

}

process.on('SIGINT', () => {
  process.stdin.resume();
  console.log(' TP:', TP, ' FP:', FP, ' FN:', FN)
  process.exit()
});

process.on('exit', () => {
  process.stdin.resume();
  console.log(' TP:', TP, ' FP:', FP, ' FN:', FN)
  process.exit()
});

realtimeTest()

// Get the csv 

// Get the coordinates

// Score the coordinates

// 