const { Pool } = require('pg')
const fs = require('fs')
var copyFrom = require('pg-copy-streams').from
const decompress = require('decompress')
const request = require('request')

const config = require('./config/config')

const pgPool = new Pool(config.pg)

const test = async () => {

  const client = await pgPool.connect()

  await client.query('TRUNCATE tmp_stop_times')

  client.release()

  try {

    await new Promise(async (resolve, reject) => {
      pgPool.connect((err, client) => {

        if(err) {
          reject(err)
        }

        let stream = client.query(copyFrom('COPY tmp_stop_times (trip_id,stop_sequence,stop_id,stop_headsign,arrival_time,departure_time,pickup_type,drop_off_type,timepoint,shape_dist_traveled,fare_units_traveled) FROM STDIN CSV HEADER'))
        let fileStream = fs.createReadStream('./tmp/stop_times.txt')
        fileStream.on('error', reject)
        fileStream.on('drain', reject)
        fileStream.on('finish', () => {
          console.log('finished!')
          // resolve() 
        })
        fileStream.on('close', async () => {
          const result = await client.query('SELECT COUNT(trip_id) FROM tmp_stop_times')
          console.log('closed!', result.rows[0].count)
          // resolve() 
        })
        stream.on('error', reject)
        stream.on('end', () => {
          console.log('stream ended!')
          // resolve() 
        })
        fileStream.pipe(stream) 
      })
    })
  } catch(e) {
    console.log({ error: e })
  }

}

test()