const decompress = require('decompress')
const request = require('request')
const fs = require('fs')
const { Pool } = require('pg')
var copyFrom = require('pg-copy-streams').from
const { orderBy, filter } = require('lodash')
const moment = require('moment')
const utils = require('./utils.js')
const { performance } = require('perf_hooks')
const Sentry = require('@sentry/node')
const { Queue } = require('./queue.js')
const cron = require('node-cron')

const config = require('./config/config')

const ingestLatestGTFS =  async ({ force }) => {
  console.log('go ahead')
  let startTime = moment()
  
  try {
    Sentry.captureMessage('GTFS Ingestion started on: ' + new Date())
    const zipFile = 'gtfs-openov-nl.zip'
    const extractEntryTo = ''
    const outputDir = './tmp/'

    const pgPool = new Pool(config.pg)
    console.log('connected to Postgis!')

    const client = await pgPool.connect()
    const trajectoryCount = await client.query('SELECT COUNT(*) FROM trajectories')

    if(trajectoryCount.rows[0].count > 0 && !force) {
      return false; 
    }  
    
    client.release()

    async function downloadGtfs() { 
      console.log('step 2')
      return new Promise((resolve, reject) => {
        request('http://gtfs.openov.nl/gtfs-rt/gtfs-openov-nl.zip')
          .on('error', function(err) {
            reject(err)
          })
          .on('end', () => {
            console.log('step 3')
            Sentry.captureMessage('GTFS Ingestion -- TRUNCATED temp_shapes')
            console.log('Finished downloading GTFS NL')
            resolve()
          })
          .pipe(
            fs.createWriteStream(zipFile)
          )
      })
      
    }

    console.log('step 0')
    await new Promise(async (resolve, reject) => {
      console.log('step 1')
      await downloadGtfs()
      console.log('stap 4')

      decompress(zipFile, 'tmp').then(files => {
        fs.unlink(zipFile)
        console.log('unlinked')
        resolve()
      }).catch(err => {
        Sentry.captureException(err)
        reject(err)
      })
    })

    console.log('step 5')

    await new Promise(async (resolve, reject) => {
      console.log(new Date(), ' Inserting shapes')
      const client = await pgPool.connect()
      let stream = client.query(copyFrom('COPY tmp_temp_shapes (shape_id,shape_pt_sequence,shape_pt_lat,shape_pt_lon,shape_dist_traveled) FROM STDIN CSV HEADER'))
      let fileStream = fs.createReadStream('./tmp/shapes.txt')
      fileStream.on('error', err => {
        reject(err)
      })
      stream.on('error', err => {
        console.log('shapes, joe error')
        client.release()
        reject(err)
      })
      stream.on('end', () => {
        console.log('shapes, joe done')
        Sentry.captureMessage('GTFS Ingestion -- INSERTED shapes')
        client.release()
        resolve()
      })
      fileStream.pipe(stream)
    })

    console.log('step 6')

    await new Promise(async (resolve, reject) => {
      console.log(new Date(), ' Inserting stop_times')
      const client = await pgPool.connect()
      let stream = client.query(copyFrom('COPY tmp_stop_times (trip_id,stop_sequence,stop_id,stop_headsign,arrival_time,departure_time,pickup_type,drop_off_type,timepoint,shape_dist_traveled,fare_units_traveled) FROM STDIN CSV HEADER'))
      let fileStream = fs.createReadStream('./tmp/stop_times.txt')

      fileStream.on('error', err => {
        console.log('stoptimes, joe error file', err)
        reject(err)
        Sentry.captureException(err)
      })
      stream.on('error', err => {
        console.log('stoptimes, joe error stream', err)
        reject(err)
        Sentry.captureException(err)
        client.release()
      })
      stream.on('end', () => {
        console.log('stoptimes, joe doen')
        Sentry.captureMessage('GTFS Ingestion -- INSERTED stop_times')
        client.release()
        resolve()
      })
      fileStream.pipe(stream)
    })

    console.log('step 7')

    await new Promise(async (resolve, reject) => {
      console.log(new Date(), ' Inserting trips')
      const client = await pgPool.connect()
      let stream = client.query(copyFrom('COPY tmp_trips (route_id,service_id,trip_id,realtime_trip_id,trip_headsign,trip_short_name,trip_long_name,direction_id,block_id,shape_id,wheelchair_accessible,bikes_allowed) FROM STDIN CSV HEADER'))
      let fileStream = fs.createReadStream('./tmp/trips.txt')

      fileStream.on('error', err => {
        reject(err)
      })
      stream.on('error', err => {
        client.release()
        reject(err)
      })
      stream.on('end', () => {
        Sentry.captureMessage('GTFS Ingestion -- INSERTED trips')
        client.release()
        resolve()
      })
      fileStream.pipe(stream)
    })

    console.log('step 8')

    await new Promise(async (resolve, reject) => {
      console.log(new Date(), ' Inserting routes')
      const client = await pgPool.connect()
      let stream = client.query(copyFrom('COPY tmp_routes (route_id,agency_id,route_short_name,route_long_name,route_desc,route_type,route_color,route_text_color,route_url) FROM STDIN CSV HEADER'))
      let fileStream = fs.createReadStream('./tmp/routes.txt')

      fileStream.on('error', err => {
        reject(err)
      })
      stream.on('error', err => {
        client.release()
        reject(err)
      })
      stream.on('end', () => {
        Sentry.captureMessage('GTFS Ingestion -- INSERTED routes')
        client.release()
        resolve()
      })
      fileStream.pipe(stream) 
    })

    console.log('step 9')

    await new Promise(async (resolve, reject) => {
      console.log(new Date(), ' Inserting stops')
      const client = await pgPool.connect()
      let stream = client.query(copyFrom('COPY tmp_stops (stop_id,stop_code,stop_name,stop_lat,stop_lon,location_type,parent_station,stop_timezone,wheelchair_boarding,platform_code) FROM STDIN CSV HEADER'))
      let fileStream = fs.createReadStream('./tmp/stops.txt')

      fileStream.on('error', err => {
        reject(err)
      })
      stream.on('error', err => {
        client.release()
        reject(err)
      })
      stream.on('end', () => {
        Sentry.captureMessage('GTFS Ingestion -- INSERTED stops')
        client.release()
        resolve()
      })
      fileStream.pipe(stream)
    })

    console.log('step 10')

    await new Promise(async (resolve, reject) => {
      console.log(new Date(), ' Inserting calendar_dates')
      const client = await pgPool.connect()
      let stream = client.query(copyFrom('COPY tmp_calendar_dates (service_id,date,exception_type) FROM STDIN CSV HEADER'))
      let fileStream = fs.createReadStream('./tmp/calendar_dates.txt')

      fileStream.on('error', err => {
        reject(err)
      })
      stream.on('error', err => {
        client.release()
        reject(err)
      })
      stream.on('end', () => {
        Sentry.captureMessage('GTFS Ingestion -- INSERTED calendar_dates')
        client.release()
        resolve()
      })
      fileStream.pipe(stream) 
    })

    // console.log('step 11')
    console.log('need to access the function')
    await new Promise(async (resolve, reject) => {
      console.log('accessed the function')
      const today = moment().format('YYYYMMDD')
      const tomorrow = moment().add(1, 'day').format('YYYYMMDD')

      const client = await pgPool.connect()
      const trips = await client.query({ text: 'SELECT * FROM tmp_trips T JOIN tmp_calendar_dates CD ON T.service_id = CD.service_id WHERE (CD.date = $1 OR CD.date = $2) AND T.shape_id IS NOT NULL', values: [today, tomorrow] })
      client.release()

      const tripQueue = new Queue(trips.rows)
      console.log('queue init length: ', trips.rows.length)
      const initialTripQueueLength = trips.rows.length
      let i = 0
      let totalProcessingTime = 0 

      while(!tripQueue.isEmpty()) {
        i = i + 1
        var t0 = performance.now()
        const client = await pgPool.connect() 
        const trip = tripQueue.dequeue() 
        
        var i0 = performance.now()

        try {

          await client.query('BEGIN')
          
          const shapes = await client.query({ text: 'SELECT * FROM tmp_temp_shapes WHERE shape_id = $1 ORDER BY shape_dist_traveled ASC', values: [trip['shape_id']] })
          const stoptimes = await client.query({ text: 'SELECT arrival_time, shape_dist_traveled, stop_lat, stop_lon FROM tmp_stop_times ST INNER JOIN tmp_stops S ON (S.stop_id = ST.stop_id) WHERE ST.trip_id = $1 ORDER BY stop_sequence ASC', values: [trip['trip_id']] })

          await client.query('COMMIT')

          const stoptimesQueue = new Queue(stoptimes.rows)
          let trajectories = []

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

          }

          trajectories = orderBy(trajectories, ['shape_dist_traveled'], ['asc'])

          let query = "INSERT INTO tmp_trajectories (trip_id, vehicle_id, geom) VALUES($1, $2, ST_GeomFromEWKT('SRID=4326;LINESTRINGM("
          let textLinestring = 'LINESTRING('
          let values = [trip.trip_id, trip.realtime_trip_id] 

          let counter = 0 

          if(trajectories.length === 0) {
            query = query + ")'))"
            console.log({ tripId: trip.trip_id, realtimeTripId: trip.realtime_trip_id, trajectories: trajectories, query: query })
            // process.exit()
          } else {
            trajectories.forEach(point => {
              counter = counter + 1 
              query = query + `${point.shape_pt_lon} ${point.shape_pt_lat} ${moment(trip.date + ' ' + point.arrival_time, "YYYYMMDD HH:mm:ss").unix()}`
              textLinestring = textLinestring + `${point.shape_pt_lon} ${point.shape_pt_lat}`

              counter !== trajectories.length ? query = query + ', ' : query = query + ")'))"
              counter !== trajectories.length ? textLinestring = textLinestring + ', ' : textLinestring = textLinestring + ")"
            })
            // console.log({ query: query })
            await client.query({ text: query, values: values })
          }

          var t1 = performance.now()
          totalProcessingTime = totalProcessingTime + (t1 - t0)

          if((i % 10000) === 0) {
            console.log('Processing time: ', (t1 - t0).toFixed(2), ' millis. Avg processing time: ', (totalProcessingTime / i).toFixed(2), ' millis.  Expected duration: ', ((totalProcessingTime / i * initialTripQueueLength) / 1000 / 60), 'min' )
          } else if(i === (initialTripQueueLength)) {
            resolve()
            console.log('DONE --- Processing time: ', (t1 - t0).toFixed(2), ' millis. Avg processing time: ', (totalProcessingTime / i).toFixed(2), ' millis.  Expected duration: ', ((totalProcessingTime / i * initialTripQueueLength) / 1000 / 60), 'min' )
          }
        } catch(e) {
          console.log('err: ', e)
          reject(e)
        } finally {
          client.release()
        }
      }
    })

    const client = await pgPool.connect()

    await client.query({ text: `UPDATE tmp_trajectories 
                                SET start_planned = subquery.start_planned,
                                    end_planned = subquery.end_planned 
                                FROM (
                                  SELECT ST_M(ST_StartPoint(geom)) AS start_planned, ST_M(ST_EndPoint(geom)) AS end_planned, trajectory_id
                                  FROM tmp_trajectories	
                                ) AS subquery
                                WHERE trajectories.trajectory_id = subquery.trajectory_id` })
    
    await client.query(`CREATE TABLE tmp_tmp_stop_times 
                        (
                          trip_id int8,
                          stop_sequence int4,
                          stop_id varchar(255),
                          stop_headsign varchar(255),
                          arrival_time varchar(255),
                          departure_time varchar(255),
                          pickup_type int4,
                          drop_off_type int4,
                          timepoint int8,
                          shape_dist_traveled int4,
                          fare_units_traveled int8, 
                          geom geometry(POINT,4326)
                        )`)
    
    await client.query(`INSERT INTO tmp_tmp_stop_times(
      trip_id, 
      stop_sequence, 
      stop_id, 
      stop_headsign, 
      arrival_time, 
      departure_time, 
      pickup_type, 
      drop_off_type, 
      timepoint, 
      shape_dist_traveled, 
      fare_units_traveled, 
      geom
    )
    (SELECT 
      trip_id, 
      stop_sequence, 
      ST.stop_id, 
      stop_headsign, 
      arrival_time, 
      departure_time, 
      pickup_type, 
      drop_off_type, 
      timepoint, 
      shape_dist_traveled, 
      fare_units_traveled, 
      ST_SetSRID(ST_MakePoint(S.stop_lon, S.stop_lat), 4326)
    FROM tmp_stop_times ST 
    JOIN tmp_stops S 
    ON ST.stop_id = S.stop_id)`)

    
    await client.query('DROP TABLE tmp_stop_times')

    await client.query('ALTER TABLE tmp_tmp_stop_times RENAME TO tmp_stop_times')

    await client.query('CREATE INDEX idx_stoptimes_stop_id ON tmp_stop_times(stop_id)')
    await client.query('CREATE INDEX idx_stoptimes_trip_id ON tmp_stop_times(trip_id)')
    
    // Have the actual switch in a SQL Transaction
    await client.query('BEGIN')

    await client.query('ALTER TABLE temp_shapes RENAME TO old_temp_shapes')
    await client.query('ALTER TABLE trajectories RENAME TO old_trajectories')
    await client.query('ALTER TABLE trips RENAME TO old_trips')
    await client.query('ALTER TABLE stop_times RENAME TO old_stop_times')
    await client.query('ALTER TABLE stops RENAME TO old_stops')
    await client.query('ALTER TABLE calendar_dates RENAME TO old_calendar_dates')
    await client.query('ALTER TABLE routes RENAME TO old_routes')

    await client.query('ALTER TABLE tmp_temp_shapes RENAME TO temp_shapes')
    await client.query('ALTER TABLE tmp_trajectories RENAME TO trajectories')
    await client.query('ALTER TABLE tmp_trips RENAME TO trips')
    await client.query('ALTER TABLE tmp_stop_times RENAME TO stop_times')
    await client.query('ALTER TABLE tmp_stops RENAME TO stops')
    await client.query('ALTER TABLE tmp_calendar_dates RENAME TO calendar_dates')
    await client.query('ALTER TABLE tmp_routes RENAME TO routes')

    await client.query('COMMIT')

    await client.query('TRUNCATE old_temp_shapes')
    await client.query('TRUNCATE old_trajectories')
    await client.query('TRUNCATE old_trips')
    await client.query('TRUNCATE old_stop_times')
    await client.query('TRUNCATE old_stops')
    await client.query('TRUNCATE old_calendar_dates')
    await client.query('TRUNCATE old_routes')

    await client.query('ALTER TABLE old_temp_shapes RENAME TO tmp_temp_shapes')
    await client.query('ALTER TABLE old_trajectories RENAME TO tmp_trajectories')
    await client.query('ALTER TABLE old_trips RENAME TO tmp_trips')
    await client.query('ALTER TABLE old_stop_times RENAME TO tmp_stop_times')
    await client.query('ALTER TABLE old_stops RENAME TO tmp_stops')
    await client.query('ALTER TABLE old_calendar_dates RENAME TO tmp_calendar_dates')
    await client.query('ALTER TABLE old_routes RENAME TO tmp_routes')

    client.release() 
  } catch(e) {
    console.log('err: ', e)
    Sentry.captureException(e);
  } finally {
    let endTime = moment() 
    Sentry.captureMessage('GTFS Ingestion finished in ' + moment.utc(moment(endTime).diff(startTime)).format('HH:mm:ss'))
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