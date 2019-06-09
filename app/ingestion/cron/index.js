'use strict'

const cron = require('node-cron')
const decompress = require('decompress')
const request = require('request')
const fs = require('fs')
const { Client } = require('pg')
var copyFrom = require('pg-copy-streams').from;
const async = require('async')
const _ = require('lodash')
const moment = require('moment')
const util = require('util')

const config = require('../config/config')

const ingestLatestGTFS = async () => {

  const zipFile = 'gtfs-openov-nl.zip'
  const extractEntryTo = ''
  const outputDir = './tmp/'

  const client = new Client(config.pg)
  await client.connect()

  await client.query('TRUNCATE temp_shapes')
  console.log(new Date(), ' Temp Shapes table truncated')

  console.log(new Date(), ' Truncate trajectories table')
  await client.query('TRUNCATE trajectories')

  console.log(new Date(), ' Truncate trips table')
  await client.query('TRUNCATE trips')

  console.log(new Date(), ' Truncate stop_times table')
  await client.query('TRUNCATE stop_times')

  console.log(new Date(), ' Truncate stops table')
  await client.query('TRUNCATE stops')

  console.log(new Date(), ' Truncate stops table')
  await client.query('TRUNCATE stops')

  console.log(new Date(), ' Truncate calendar dates table')
  await client.query('TRUNCATE calendar_dates')

  async.waterfall([
    callback => {
      request('http://gtfs.openov.nl/gtfs-rt/gtfs-openov-nl.zip')
        .on('error', function(err) {
          callback(err)
        })
        .on('end', () => {
          console.log('Finished downloading GTFS NL')
          callback(false)
        })
        .pipe(fs.createWriteStream(zipFile))
    }, 
    callback => {
      decompress(zipFile, 'tmp').then(files => {
        fs.unlink(zipFile)
        console.log('unlinked!')
        callback(false)
      }).catch(err => callback(err))
    }, 
    callback => {
      let stream = client.query(copyFrom('COPY temp_shapes (shape_id,shape_pt_sequence,shape_pt_lat,shape_pt_lon,shape_dist_traveled) FROM STDIN CSV HEADER'))
      let fileStream = fs.createReadStream('./tmp/shapes.txt')
      fileStream.on('error', err => {
        callback(err)
      })
      stream.on('error', err => {
        callback(err)
      })
      stream.on('end', () => {
        callback()
      })
      fileStream.pipe(stream)
    }, 
    callback => {
      console.log(new Date(), ' Inserting stop_times')
      let stream = client.query(copyFrom('COPY stop_times (trip_id,stop_sequence,stop_id,stop_headsign,arrival_time,departure_time,pickup_type,drop_off_type,timepoint,shape_dist_traveled,fare_units_traveled) FROM STDIN CSV HEADER'))
      let fileStream = fs.createReadStream('./tmp/stop_times.txt')

      fileStream.on('error', err => {
        callback(err)
      })
      stream.on('error', err => {
        callback(err)
      })
      stream.on('end', () => {
        callback()
      })
      fileStream.pipe(stream) 
    },
    callback => {
      console.log(new Date(), ' Inserting trips')
      let stream = client.query(copyFrom('COPY trips (route_id,service_id,trip_id,realtime_trip_id,trip_headsign,trip_short_name,trip_long_name,direction_id,block_id,shape_id,wheelchair_accessible,bikes_allowed) FROM STDIN CSV HEADER'))
      let fileStream = fs.createReadStream('./tmp/trips.txt')

      fileStream.on('error', err => {
        callback(err)
      })
      stream.on('error', err => {
        callback(err)
      })
      stream.on('end', () => {
        callback()
      })
      fileStream.pipe(stream) 
    },
    callback => {
      console.log(new Date(), ' Inserting stops')
      let stream = client.query(copyFrom('COPY stops (stop_id,stop_code,stop_name,stop_lat,stop_lon,location_type,parent_station,stop_timezone,wheelchair_boarding,platform_code) FROM STDIN CSV HEADER'))
      let fileStream = fs.createReadStream('./tmp/stops.txt')

      fileStream.on('error', err => {
        callback(err)
      })
      stream.on('error', err => {
        callback(err)
      })
      stream.on('end', () => {
        callback()
      })
      fileStream.pipe(stream) 
    },
    callback => {
      console.log(new Date(), ' Inserting calendar_dates')
      let stream = client.query(copyFrom('COPY calendar_dates (service_id,date,exception_type) FROM STDIN CSV HEADER'))
      let fileStream = fs.createReadStream('./tmp/calendar_dates.txt')

      fileStream.on('error', err => {
        callback(err)
      })
      stream.on('error', err => {
        callback(err)
      })
      stream.on('end', () => {
        callback()
      })
      fileStream.pipe(stream) 
    },
    callback => {
      const today = moment().format('YYYYMMDD')
      const tomorrow = moment().add(1, 'day').format('YYYYMMDD')

      let timeStart = Date.now() 

      client.query('SELECT * FROM trips T JOIN calendar_dates CD ON T.service_id = CD.service_id WHERE CD.date = $1 OR CD.date = $2 LIMIT 10', [today, tomorrow], async (err, trips) => {
        if(err) {
          callback(err)
        }

        let tripsProcessed = 0
        console.log('trip amount: ', trips.rows.length)
        
        for(const index in trips.rows) {
          const trip = trips.rows[index]
          
          tripsProcessed = tripsProcessed + 1 
          console.log('2', Date.now() - timeStart)
          timeStart = Date.now()
          try {
            const shapes = await client.query({ text: 'SELECT * FROM temp_shapes WHERE shape_id = $1 ORDER BY shape_dist_traveled ASC', values: [trip['shape_id']] })
            console.log('3', Date.now() - timeStart)
            timeStart = Date.now()
            const stoptimes = await client.query({ text: 'SELECT arrival_time, shape_dist_traveled, stop_lat, stop_lon FROM stop_times ST INNER JOIN stops S ON (S.stop_id = ST.stop_id) WHERE ST.trip_id = $1 ORDER BY shape_dist_traveled ASC', values: [trip['trip_id']] })
            console.log('4', Date.now()- timeStart)
            timeStart = Date.now()
            let stoptimesProcessed = 0 
          
            // Point to point matching with two vertices (v1, v2) and a stop (s1), as proposed by Brosi (2014)

            let trajectoryBins = []
            async.waterfall([
              innerCallback => {
                for(let i = 0; i < (stoptimes.rows.length - 1); i++) {

                  try {
                    const A = stoptimes.rows[i]
                    const B = stoptimes.rows[i + 1]
                  
                    // Use UTC to prevent DST issues
                    const A_time = moment.utc(A['arrival_time'], 'HH:mm')
                    const B_time = moment.utc(B['arrival_time'], 'HH:mm')
                  
                    // Account for crossing over to midnight the next day
                    if(B_time.isBefore(A_time)) B_time.add(1, 'day')
                    
                    // Calculate the duration
                    const t_AB = moment.duration(B_time.diff(A_time))
                  
                    // Calculate the distance between stops
                    const d_AB = B['shape_dist_traveled'] - A['shape_dist_traveled']
                  
                    const vertices = _.filter(shapes.rows, (shape) => 
                      shape.shape_dist_traveled >= A['shape_dist_traveled'] && 
                      shape.shape_dist_traveled <= B['shape_dist_traveled'])
                  
                    for(let j = 0; j < vertices.length; j++) {
                      
                      // Calculate the distance from v1 to A
                      const v1 = vertices[j]
                      let d_v1_A = v1['shape_dist_traveled'] - A['shape_dist_traveled']
                      
                      vertices[j]['arrival_time'] = moment.utc((d_v1_A / d_AB * t_AB) + A_time).format('HH:mm:ss')
                    }

                    const bin = {
                      start: {
                        shape_dist_traveled: parseInt(A['shape_dist_traveled']),
                        arrival_time: moment(A_time).format('HH:mm:ss'),
                        shape_pt_lat: A['stop_lat'], 
                        shape_pt_lon: B['stop_lon']
                      },
                      end: {
                        shape_dist_traveled: parseInt(B['shape_dist_traveled']),
                        arrival_time: moment(B_time).format('HH:mm:ss'),
                        shape_pt_lat: B['stop_lat'], 
                        shape_pt_lon: B['stop_lon']
                      },
                      vertices: vertices
                    }
                  
                    trajectoryBins.push(bin)

                    if(i === (stoptimes.rows.length - 2)) {
                      innerCallback(false, trajectoryBins)
                    }
                  } catch(e) {
                    console.log('err: ', e)
                  }
                }

                console.log('5', Date.now()- timeStart)
                timeStart = Date.now()
              }, 
              (trajectoryBins, innerCallback) => {
                trajectoryBins = _.orderBy(trajectoryBins, ['start', 'shape_dist_traveled'],['asc'])

                let trajectory = []

                trajectoryBins.forEach(bin => {
                  trajectory.push(bin['start'])
                  trajectory.push(bin['end'])
                  trajectory = [...trajectory, ...bin['vertices']]
                })

                const trajectoryUnique = _.uniqWith(trajectory, _.isEqual)
                console.log('6', Date.now()-timeStart)
                timeStart = Date.now()
                innerCallback(false, trajectoryUnique)
              }, 
              (trajectoryUnique, innerCallback) => {
                let query = "INSERT INTO trajectories (trip_id, geom3) VALUES($1, ST_Force_3D(ST_GeomFromEWKT('SRID=4326;LINESTRINGM("
                let values = [trip.trip_id] 

                let counter = 0 
                trajectoryUnique.forEach(point => {
                  counter = counter + 1 
                  query = query + `${point.shape_pt_lon} ${point.shape_pt_lat} ${moment(trip.date + ' ' + point.arrival_time, "YYYYMMDD HH:mm:ss").unix()}`

                  counter !== trajectoryUnique.length ? query = query + ', ' : query = query + ")')))"
                })

                try {
                  client.query({ text: query, values: values }, (err, response) => {
                    console.log('7', Date.now()- timeStart)
                    timeStart = Date.now()
                    if(err) innerCallback(err) 

                    if(response) innerCallback()
                  })

                  
                } catch(e) {
                  innerCallback()
                  console.log('e1: ', e)
                }
              }
            ], (err, result) => {
              if(err) {
                console.log('err: ', err)
              }
            })

            // console.log(util.inspect(trajectoryBins, false, null, true /* enable colors */))
          } catch(e) {
            console.log('err: ', e)
          }

        }

        callback()

      })
    },
  ], (err, result) => {
    console.log('err: ', err, result)
  })
}  

ingestLatestGTFS() 

const task = cron.schedule('0 0 3 * * *', () => {
  ingestLatestGTFS()
}, {
  scheduled: false, 
  timezone: "Europe/Amsterdam"
})