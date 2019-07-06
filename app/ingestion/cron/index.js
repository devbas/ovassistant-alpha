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
const utils = require('../utils')

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
      console.log(new Date(), ' Inserting shapes')
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

      client.query('SELECT * FROM trips T JOIN calendar_dates CD ON T.service_id = CD.service_id WHERE CD.date = $1 OR CD.date = $2', [today, tomorrow], async (err, trips) => {
        if(err) {
          callback(err)
        }

        let tripsProcessed = 0
        
        for(const index in trips.rows) {
          const trip = trips.rows[index]
          
          tripsProcessed = tripsProcessed + 1 
          try {
            const shapes = await client.query({ text: 'SELECT * FROM temp_shapes WHERE shape_id = $1 ORDER BY shape_dist_traveled ASC', values: [trip['shape_id']] })
            const stoptimes = await client.query({ text: 'SELECT arrival_time, shape_dist_traveled, stop_lat, stop_lon FROM stop_times ST INNER JOIN stops S ON (S.stop_id = ST.stop_id) WHERE ST.trip_id = $1 ORDER BY stop_sequence ASC', values: [trip['trip_id']] })
          
            // Point to point matching with two vertices (v1, v2) and a stop (s1), as proposed by Brosi (2014)

            let trajectories = []
            async.waterfall([
              innerCallback => {
                for(let i = 0; i < (stoptimes.rows.length - 1); i++) {

                  try {
                    const A = stoptimes.rows[i]
                    const B = stoptimes.rows[i + 1]
                  
                    // Use UTC to prevent DST issues
                    const A_time = moment.utc(utils.fixTime(A['arrival_time']), 'HH:mm:ss')
                    const B_time = moment.utc(utils.fixTime(B['arrival_time']), 'HH:mm:ss')
                    const timeFormat = RegExp('^(0[0-9]|1[0-9]|2[0-3]|[0-9]):[0-5][0-9]:[0-5][0-9]$')


                    // Account for crossing over to midnight the next day
                    if(B_time.isBefore(A_time)) {
                      B_time.add(1, 'day')
                    } else if(!timeFormat.test(A['arrival_time']) && !timeFormat.test(B['arrival_time'])) {
                      A_time.add(1, 'day')
                      B_time.add(1, 'day')
                    }
                    
                    // Calculate the duration
                    const t_AB = moment.duration(B_time.diff(A_time)).asMilliseconds()
                  
                    // Calculate the distance between stops
                    const d_AB = B['shape_dist_traveled'] - A['shape_dist_traveled'] === 0 ? 1 : B['shape_dist_traveled'] - A['shape_dist_traveled']
                  
                    const vertices = _.filter(shapes.rows, (shape) => 
                      shape.shape_dist_traveled >= A['shape_dist_traveled'] && 
                      shape.shape_dist_traveled <= B['shape_dist_traveled'])
                  
                    for(let j = 0; j < vertices.length; j++) {
                      // Calculate the distance from v1 to A
                      const v1 = vertices[j]
                      let d_v1_A = v1['shape_dist_traveled'] - A['shape_dist_traveled'] === 0 ? 1 : v1['shape_dist_traveled'] - A['shape_dist_traveled']

                      vertices[j]['arrival_time'] = moment.utc((d_v1_A / d_AB * t_AB) + A_time).format('HH:mm:ss')
                      
                      if(vertices[j]['arrival_time'] === 'Invalid date') {
                        console.log('time stuff: ', d_v1_A, d_AB, t_AB, A_time, A['arrival_time'], B['arrival_time']);
                        console.log('arrival_time: ', moment.utc((d_v1_A / d_AB * t_AB) + A_time).format('HH:mm:ss'))
                        process.exit()
                      }
                    }

                    trajectories = [...trajectories, ...vertices]

                    if(i === (stoptimes.rows.length - 2)) {
                      // innerCallback(false, trajectoryBins)
                      innerCallback(false, trajectories)
                    }
                  } catch(e) {
                    console.log('err 1: ', e, ' for the trip: ', trip)
                    process.exit(); 
                  }
                }
              }, 
              (trajectories, innerCallback) => {
                trajectories = _.orderBy(trajectories, ['shape_dist_traveled'], ['asc'])

                // const trajectoryUnique = _.uniqWith(trajectories, _.isEqual)
                innerCallback(false, trajectories)
              }, 
              (trajectoryUnique, innerCallback) => {
                // let query = "INSERT INTO trajectories (trip_id, content, geom6) VALUES($1, $2, ST_Force_3D(ST_GeomFromEWKT('SRID=4326;LINESTRINGM("
                let query = "INSERT INTO trajectories (trip_id, geom) VALUES($1, ST_GeomFromText('SRID=4326;LINESTRINGM("
                let textLinestring = 'LINESTRING('
                let values = [trip.trip_id] 

                let counter = 0 
                trajectoryUnique.forEach(point => {
                  // console.log('unix timestamp: ', moment(trip.date + ' ' + point.arrival_time, "YYYYMMDD HH:mm:ss").unix())
                  counter = counter + 1 
                  query = query + `${point.shape_pt_lon} ${point.shape_pt_lat} ${moment(trip.date + ' ' + point.arrival_time, "YYYYMMDD HH:mm:ss").unix()}`
                  textLinestring = textLinestring + `${point.shape_pt_lon} ${point.shape_pt_lat}`

                  // counter !== trajectoryUnique.length ? query = query + ', ' : query = query + ")')))"
                  counter !== trajectoryUnique.length ? query = query + ', ' : query = query + ")'))"
                  counter !== trajectoryUnique.length ? textLinestring = textLinestring + ', ' : textLinestring = textLinestring + ")"
                })

                try {
                  if(trajectoryUnique.length > 0) {
                    client.query({ text: query, values: values }, (err, response) => {
                      if(err) innerCallback({ err: err, query: query }) 

                      if(response) innerCallback()
                    })
                  }
                } catch(e) {
                  innerCallback()
                  console.log('e1: ', e)
                }
              }, 
              (innerCallback) => {
                try {
                  client.query({ text: `UPDATE trajectories 
                                        SET start_planned = subquery.start_planned,
                                            end_planned = subquery.end_planned 
                                        FROM (
                                          SELECT ST_M(ST_StartPoint(geom)) AS start_planned, ST_M(ST_EndPoint(geom)) AS end_planned, trajectory_id
                                          FROM trajectories	
                                        ) AS subquery
                                        WHERE trajectories.trajectory_id = subquery.trajectory_id` },
                    (err, response) => {
                      if(err) innerCallback({ err: err, query: query })

                      if(response) innerCallback() 
                    })
                } catch(e) {
                  innerCallback()
                  console.log('e5', e)
                } 
              }
            ], (err, result) => {
              if(err) {
                console.log('err 2: ', err.err, ' for trip: ', trip, ' with query: ', err.query) 
                process.exit()
              }
            })

            // console.log(util.inspect(trajectoryBins, false, null, true /* enable colors */))
          } catch(e) {
            console.log('err 3: ', e, ' for trip: ', trip)
            process.exit()
          }

        }

        callback()

      })
    },
  ], (err, result) => {
    if(err) {
      console.log('err: ', err, ' for the following trip: ', trip)
    } else {
      console.log('result: ', result)
    }
  })
}  

ingestLatestGTFS() 

const task = cron.schedule('0 0 3 * * *', () => {
  ingestLatestGTFS()
}, {
  scheduled: false, 
  timezone: "Europe/Amsterdam"
})