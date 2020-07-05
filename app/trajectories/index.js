const decompress = require('decompress')
const request = require('request')
const fs = require('fs')
const { Pool } = require('pg')
var copyFrom = require('pg-copy-streams').from
const { orderBy, filter } = require('lodash')
const moment = require('moment')
const momenttz = require('moment-timezone')
const utils = require('./utils.js')
const { performance } = require('perf_hooks')
const Sentry = require('@sentry/node')
const { Queue } = require('./queue.js')
const cron = require('node-cron')
const _ = require('lodash')
const util = require('util')

Sentry.init({ dsn: process.env.SENTRY_DSN });

const config = require('./config/config')

const ingestLatestGTFS =  async ({ force }) => {
  console.log('go ahead')
  let startTime = moment()
  
  try {
    // Sentry.captureMessage('GTFS Ingestion started on: ' + new Date())
    // const zipFile = 'gtfs-openov-nl.zip'
    // const extractEntryTo = ''
    // const outputDir = './tmp/'
    // const tripTimesDirectory = './tmp/trip_times/'

    const pgPool = new Pool(config.pg)

    // console.log('connected to Postgis!')
    // // const trajectoryCount = await client.query('SELECT COUNT(*) FROM trajectories')

    // // if(trajectoryCount.rows[0].count > 0 && !force) {
    // //   return false; 
    // // }  

    // let client = await pgPool.connect()

    // await client.query('TRUNCATE tmp_temp_shapes')
    // await client.query('TRUNCATE tmp_trajectories')
    // await client.query('TRUNCATE tmp_trips')
    // await client.query('TRUNCATE tmp_stop_times')
    // await client.query('TRUNCATE tmp_stops')
    // await client.query('TRUNCATE tmp_calendar_dates')
    // await client.query('TRUNCATE tmp_routes')
    // await client.query('TRUNCATE tmp_trip_times')
    // await client.query('TRUNCATE tmp_shapelines')
    
    // client.release()

    // async function downloadGtfs() { 
    //   console.log('step 2')
    //   return new Promise((resolve, reject) => {
    //     request('http://gtfs.openov.nl/gtfs-rt/gtfs-openov-nl.zip')
    //       .on('error', function(err) {
    //         reject(err)
    //       })
    //       .on('end', () => {
    //         console.log('Finished downloading GTFS NL')
    //         resolve()
    //       })
    //       .pipe(
    //         fs.createWriteStream(zipFile)
    //       )
    //   })
    // }

    // console.log('step 0')
    // await new Promise(async (resolve, reject) => {
    //   // console.log('step 1')
    //   await downloadGtfs()
    //   console.log('stap 4')

    //   decompress(zipFile, 'tmp').then(files => {
    //     fs.unlink(zipFile)
    //     console.log('unlinked')
    //     resolve()
    //   }).catch(err => {
    //     Sentry.captureException(err)
    //     reject(err)
    //   })
    // })

    // console.log('step 5')

    // await new Promise((resolve, reject) => {
    //   pgPool.connect((err, client) => {

    //     if(err) {
    //       reject(err)
    //     }

    //     let stream = client.query(copyFrom('COPY tmp_temp_shapes (shape_id,shape_pt_sequence,shape_pt_lat,shape_pt_lon,shape_dist_traveled) FROM STDIN CSV HEADER'))
    //     let fileStream = fs.createReadStream('./tmp/shapes.txt')
    //     fileStream.on('error', reject)
    //     fileStream.on('drain', reject)
    //     fileStream.on('finish', resolve)
    //     fileStream.on('close', resolve)
    //     stream.on('error', reject)
    //     stream.on('end', resolve)
    //     fileStream.pipe(stream)
    //   })
    // })

    // console.log('step 6')

    // await new Promise((resolve, reject) => {
    //   console.log(new Date(), ' Inserting stop_times')
    //   pgPool.connect((err, client) => {

    //     if(err) {
    //       reject(err)
    //     }

    //     let stream = client.query(copyFrom('COPY tmp_stop_times (trip_id,stop_sequence,stop_id,stop_headsign,arrival_time,departure_time,pickup_type,drop_off_type,timepoint,shape_dist_traveled,fare_units_traveled) FROM STDIN CSV HEADER'))
    //     let fileStream = fs.createReadStream('./tmp/stop_times.txt')
    //     fileStream.on('error', reject)
    //     fileStream.on('drain', reject)
    //     fileStream.on('finish', resolve)
    //     fileStream.on('close', async () => {
    //       const result = await client.query('SELECT COUNT(trip_id) FROM tmp_stop_times')
    //       console.log('tmp_stop_times closed!', result.rows[0].count)
    //       resolve() 
    //     })
    //     stream.on('error', reject)
    //     stream.on('end', resolve)
    //     fileStream.pipe(stream)
    //   })
    // })

    // client = await pgPool.connect()

    // await client.query(`CREATE TABLE tmp_tmp_stop_times 
    //                     (
    //                       trip_id int8,
    //                       stop_sequence int4,
    //                       stop_id varchar(255),
    //                       stop_headsign varchar(255),
    //                       arrival_time varchar(255),
    //                       departure_time varchar(255),
    //                       pickup_type int4,
    //                       drop_off_type int4,
    //                       timepoint int8,
    //                       shape_dist_traveled int4,
    //                       fare_units_traveled int8, 
    //                       geom geometry(POINT,4326)
    //                     )`)
    
    // await client.query(`INSERT INTO tmp_tmp_stop_times(
    //   trip_id, 
    //   stop_sequence, 
    //   stop_id, 
    //   stop_headsign, 
    //   arrival_time, 
    //   departure_time, 
    //   pickup_type, 
    //   drop_off_type, 
    //   timepoint, 
    //   shape_dist_traveled, 
    //   fare_units_traveled, 
    //   geom
    // )
    // (SELECT 
    //   trip_id, 
    //   stop_sequence, 
    //   ST.stop_id, 
    //   stop_headsign, 
    //   arrival_time, 
    //   departure_time, 
    //   pickup_type, 
    //   drop_off_type, 
    //   timepoint, 
    //   shape_dist_traveled, 
    //   fare_units_traveled, 
    //   ST_SetSRID(ST_MakePoint(S.stop_lon, S.stop_lat), 4326)
    // FROM tmp_stop_times ST 
    // JOIN tmp_stops S 
    // ON ST.stop_id = S.stop_id)`)

    
    // await client.query('DROP TABLE tmp_stop_times')

    // await client.query('ALTER TABLE tmp_tmp_stop_times RENAME TO tmp_stop_times')

    // await client.query(`CREATE INDEX "${utils.makeId()}_idx_stoptimes_stop_id" ON tmp_stop_times(stop_id)`)
    // await client.query(`CREATE INDEX "${utils.makeId()}_idx_stoptimes_trip_id" ON tmp_stop_times(trip_id)`)
    // await client.query(`CREATE INDEX "${utils.makeId()}_idx_stoptimes_geom" ON tmp_stop_times USING GIST(geom)`)

    // client.release()

    // await new Promise(async (resolve, reject) => {
    //   pgPool.connect((err, client) => {

    //     if(err) {
    //       reject(err)
    //     }

    //     let stream = client.query(copyFrom('COPY tmp_calendar_dates (service_id,date,exception_type) FROM STDIN CSV HEADER'))
    //     let fileStream = fs.createReadStream('./tmp/calendar_dates.txt')
    //     fileStream.on('error', reject)
    //     fileStream.on('drain', reject)
    //     fileStream.on('finish', resolve)
    //     fileStream.on('close', async () => {
    //       const result = await client.query('SELECT COUNT(service_id) FROM tmp_calendar_dates')
    //       console.log('tmp_calendar_dates closed!', result.rows[0].count)
    //       resolve() 
    //     })
    //     stream.on('error', reject)
    //     stream.on('end', resolve)
    //     fileStream.pipe(stream) 
    //   })
    // })

    // console.log('step 7')

    // await new Promise((resolve, reject) => {
    //   console.log(new Date(), ' Inserting trips')
    //   pgPool.connect((err, client) => {

    //     if(err) {
    //       reject(err)
    //     }

    //     let stream = client.query(copyFrom('COPY tmp_trips (route_id,service_id,trip_id,realtime_trip_id,trip_headsign,trip_short_name,trip_long_name,direction_id,block_id,shape_id,wheelchair_accessible,bikes_allowed) FROM STDIN CSV HEADER'))
    //     let fileStream = fs.createReadStream('./tmp/trips.txt')
    //     fileStream.on('error', reject)
    //     fileStream.on('drain', reject)
    //     fileStream.on('finish', resolve)
    //     fileStream.on('close', async () => {
    //       const result = await client.query('SELECT COUNT(trip_id) FROM tmp_trips')
    //       console.log('tmp_trips closed!', result.rows[0].count)
    //       resolve() 
    //     })
    //     stream.on('error', reject)
    //     stream.on('end', resolve)
    //     fileStream.pipe(stream)
    //   })
    // })

    // console.log('step 8')

    // await new Promise(async (resolve, reject) => {
    //   console.log(new Date(), ' Inserting routes')
    //   pgPool.connect((err, client) => {

    //     if(err) {
    //       reject(err)
    //     }

    //     let stream = client.query(copyFrom('COPY tmp_routes (route_id,agency_id,route_short_name,route_long_name,route_desc,route_type,route_color,route_text_color,route_url) FROM STDIN CSV HEADER'))
    //     let fileStream = fs.createReadStream('./tmp/routes.txt')
    //     fileStream.on('error', reject)
    //     fileStream.on('drain', reject)
    //     fileStream.on('finish', resolve)
    //     fileStream.on('close', resolve)
    //     stream.on('error', reject)
    //     stream.on('end', resolve)
    //     fileStream.pipe(stream)
    //   })
    // })

    // console.log('step 9')

    // await new Promise(async (resolve, reject) => {
    //   console.log(new Date(), ' Inserting stops')
    //   pgPool.connect((err, client) => {

    //     if(err) {
    //       reject(err)
    //     }

    //     let stream = client.query(copyFrom('COPY tmp_stops (stop_id,stop_code,stop_name,stop_lat,stop_lon,location_type,parent_station,stop_timezone,wheelchair_boarding,platform_code) FROM STDIN CSV HEADER'))
    //     let fileStream = fs.createReadStream('./tmp/stops.txt')
    //     fileStream.on('error', reject)
    //     fileStream.on('drain', reject)
    //     fileStream.on('finish', resolve)
    //     fileStream.on('close', resolve)
    //     stream.on('error', reject)
    //     stream.on('end', resolve)
    //     fileStream.pipe(stream)
    //   })
    // })

    // console.log('step 10')

    // await new Promise(async (resolve, reject) => {
    //   let client = await pgPool.connect()

    //   const shapes = await client.query({ text: 'SELECT DISTINCT shape_id FROM tmp_temp_shapes' })
    //   client.release()

    //   const shapeQueue = new Queue(shapes.rows)

    //   let i = 0

    //   while(!shapeQueue.isEmpty()) {
    //     const client = await pgPool.connect()

    //     const shape = shapeQueue.dequeue()

    //     try {
    //       const shapePoints = await client.query({ text: 'SELECT * FROM tmp_temp_shapes WHERE shape_id = $1 ORDER BY shape_pt_sequence ASC', values: [shape['shape_id']] })

    //       const shapePointsQueue = new Queue(shapePoints.rows)

    //       let shapeLines = ''
    //       while(!shapePointsQueue.isEmpty()) {
    //         const A = shapePointsQueue.dequeue()
    //         const B = shapePointsQueue.queueSize() === 1 ? shapePointsQueue.dequeue() : shapePointsQueue.front()
            
    //         shapeLines = shapeLines + `(ST_SetSRID(ST_MakeLine(ST_MakePoint(${A['shape_pt_lon']},${A['shape_pt_lat']}), ST_MakePoint(${B['shape_pt_lon']}, ${B['shape_pt_lat']})), 4326), ${shape['shape_id']}, ${A['shape_pt_sequence']}, ${B['shape_pt_sequence']})`            
            
    //         if(shapePointsQueue.queueSize() > 1) {
    //           shapeLines = shapeLines + ','
    //         }
    //       } 

    //       await client.query({ text: `INSERT INTO tmp_shapelines (geom, shape_id, shape_pt_sequence_start, shape_pt_sequence_end) VALUES ${shapeLines}`})

    //       client.release()

    //       if(shapeQueue.isEmpty()) {
    //         resolve()
    //       }
    //     } catch(err) {
    //       client.release()
    //       reject(err)
    //     }
    //   }
    // })

    await new Promise(async (resolve, reject) => {
      const today = moment().format('YYYYMMDD')
      const tomorrow = moment().format('YYYYMMDD')

      let client = await pgPool.connect()
      const trips = await client.query({ text: 'SELECT * FROM tmp_trips T JOIN tmp_calendar_dates CD ON T.service_id = CD.service_id WHERE (CD.date = $1 OR CD.date = $2) AND T.shape_id IS NOT NULL', values: [today, tomorrow] })
      client.release()

      const tripQueue = new Queue(trips.rows)
      
      while(!tripQueue.isEmpty()) {
        const client = await pgPool.connect()
        const trip = tripQueue.dequeue()

        try {
          await client.query('BEGIN')

          const shapes = await client.query({ text: 'SELECT * from tmp_temp_shapes WHERE shape_id = $1 ORDER BY shape_pt_sequence ASC', values: [trip['shape_id']] })
          const stoptimes = await client.query({ text: 'SELECT arrival_time, departure_time, shape_dist_traveled, stop_lat, stop_lon FROM tmp_stop_times ST INNER JOIN tmp_stops S ON (S.stop_id = ST.stop_id) WHERE ST.trip_id = $1 ORDER BY stop_sequence ASC', values: [trip['trip_id']]})
          const shapelines = await client.query({ text: `SELECT * FROM tmp_shapelines WHERE shape_id = $1`, values: [trip['shape_id']]})

          console.log({ shapeId: trip['shape_id']})
          await client.query('COMMIT')

          const stoptimesQueue = new Queue(stoptimes.rows)
          const verticesList = []

          while(!stoptimesQueue.isEmpty()) {
            const A = stoptimesQueue.dequeue()
            const B = stoptimesQueue.queueSize() === 1 ? stoptimesQueue.dequeue() : stoptimesQueue.front()

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
          
            const vertices = filter(shapes.rows, (shape) => 
              shape.shape_dist_traveled >= A['shape_dist_traveled'] && 
              shape.shape_dist_traveled < B['shape_dist_traveled'])

            for(let j = 0; j < vertices.length; j++) {
              // Calculate the distance from v1 to A
              const v1 = vertices[j]
              let d_v1_A = v1['shape_dist_traveled'] - A['shape_dist_traveled'] === 0 ? 1 : v1['shape_dist_traveled'] - A['shape_dist_traveled']

              vertices[j]['arrival_time'] = moment.utc((d_v1_A / d_AB * t_AB) + A_time).format('HH:mm:ss')
              
              if(vertices[j]['arrival_time'] === 'Invalid date') {
                console.log('time stuff: ', d_v1_A, d_AB, t_AB, A_time, A['arrival_time'], B['arrival_time']);
                console.log('arrival_time: ', moment.utc((d_v1_A / d_AB * t_AB) + A_time).format('HH:mm:ss'))
              }
            }

            verticesList.push(...vertices)
            // console.log(vertices)
            // console.log({ verticesQueue: util.inspect(vertices[0], false, null, true) })

          }

          const verticesQueue = new Queue(verticesList)
          let tripTimesList = ''

          while(!verticesQueue.isEmpty()) {
            const A = verticesQueue.dequeue()
            const B = verticesQueue.queueSize() === 1 ? verticesQueue.dequeue() : verticesQueue.front()

            const shapeline = _.filter(shapelines.rows, (shape) => 
              shape.shape_pt_sequence_start == A['shape_pt_sequence'] &&
              shape.shape_pt_sequence_end == B['shape_pt_sequence'])
            
            if(shapeline[0] && shapeline[0].shapeline_id) {
              const shapePtSequenceStart = momenttz.tz(trip.date + ' ' + A['arrival_time'], "YYYYMMDD HH:mm:ss", 'Europe/Amsterdam').unix()
              const shapePtSequenceEnd = momenttz.tz(trip.date + ' ' + B['arrival_time'], "YYYYMMDD HH:mm:ss", 'Europe/Amsterdam').unix()
              tripTimesList = tripTimesList + `(${trip['trip_id']}, ${shapeline[0].shapeline_id}, ${shapePtSequenceStart}, ${shapePtSequenceEnd})`
              if(verticesQueue.queueSize() > 1) {
                tripTimesList = tripTimesList + ','
              }
            } else if(A['shape_pt_sequence'] == B['shape_pt_sequence']) {
              // console.log({ msg: ''})
            } else {
              console.log({ msg: 'shapeline_id not found for data: ', shape_id: A['shape_id'], shape_pt_sequence_start: A['shape_pt_sequence'], shape_pt_sequence_end: B['shape_pt_sequence'] })
            }
            
          }
          await client.query({ text: `INSERT INTO tmp_trip_times (trip_id, shapeline_id, start_planned, end_planned) VALUES ${tripTimesList}`})
          
          client.release()
        } catch(err) {
          client.release()
          console.log({ msg: 'An error occurred', err: err })
          reject(err)
        }
      }

      if(tripQueue.isEmpty()) {
        resolve()
      }
    })

    client = await pgPool.connect()
    
    // Have the actual switch in a SQL Transaction
    await client.query('BEGIN')

    await client.query('ALTER TABLE temp_shapes RENAME TO old_temp_shapes')
    // await client.query('ALTER TABLE trajectories RENAME TO old_trajectories')
    await client.query('ALTER TABLE trips RENAME TO old_trips')
    await client.query('ALTER TABLE stop_times RENAME TO old_stop_times')
    await client.query('ALTER TABLE stops RENAME TO old_stops')
    await client.query('ALTER TABLE calendar_dates RENAME TO old_calendar_dates')
    await client.query('ALTER TABLE routes RENAME TO old_routes')
    await client.query('ALTER TABLE shapelines RENAME TO old_shapelines')
    await client.query('ALTER TABLE trip_times RENAME TO old_trip_times')

    await client.query('ALTER TABLE tmp_temp_shapes RENAME TO temp_shapes')
    // await client.query('ALTER TABLE tmp_trajectories RENAME TO trajectories')
    await client.query('ALTER TABLE tmp_trips RENAME TO trips')
    await client.query('ALTER TABLE tmp_stop_times RENAME TO stop_times')
    await client.query('ALTER TABLE tmp_stops RENAME TO stops')
    await client.query('ALTER TABLE tmp_calendar_dates RENAME TO calendar_dates')
    await client.query('ALTER TABLE tmp_routes RENAME TO routes')
    await client.query('ALTER TABLE tmp_shapelines RENAME TO shapelines')
    await client.query('ALTER TABLE tmp_trip_times RENAME TO trip_times')

    await client.query('COMMIT')

    await client.query('TRUNCATE old_temp_shapes')
    // await client.query('TRUNCATE old_trajectories')
    await client.query('TRUNCATE old_trips')
    await client.query('TRUNCATE old_stop_times')
    await client.query('TRUNCATE old_stops')
    await client.query('TRUNCATE old_calendar_dates')
    await client.query('TRUNCATE old_routes')
    await client.query('TRUNCATE old_shapelines')
    await client.query('TRUNCATE old_trip_times')

    await client.query('ALTER TABLE old_temp_shapes RENAME TO tmp_temp_shapes')
    // await client.query('ALTER TABLE old_trajectories RENAME TO tmp_trajectories')
    await client.query('ALTER TABLE old_trips RENAME TO tmp_trips')
    await client.query('ALTER TABLE old_stop_times RENAME TO tmp_stop_times')
    await client.query('ALTER TABLE old_stops RENAME TO tmp_stops')
    await client.query('ALTER TABLE old_calendar_dates RENAME TO tmp_calendar_dates')
    await client.query('ALTER TABLE old_routes RENAME TO tmp_routes')
    await client.query('ALTER TABLE old_shapelines RENAME TO tmp_shapelines')
    await client.query('ALTER TABLE old_trip_times RENAME TO tmp_trip_times')

    client.release() 

    await pgPool.end()
  } catch(e) {
    console.log('err: ', e)
    Sentry.captureException(e);
  } finally {
    let endTime = moment() 
    console.log('Done in ', moment.utc(moment(endTime).diff(startTime)).format('HH:mm:ss'))
  }
}

const task = cron.schedule('0 0 3 * * *', () => {
  console.log('GTFS Ingestion Scheduled!')
  ingestLatestGTFS({ force: true })
}, {
  scheduled: true, 
  timezone: "Europe/Amsterdam"
})

task.start()

ingestLatestGTFS({ force: true })