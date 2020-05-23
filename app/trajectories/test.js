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
    
    const zipFile = 'gtfs-openov-nl.zip'
    const extractEntryTo = ''
    const outputDir = './tmp/'

    async function downloadGtfs() { 
      console.log('step 2')
      return new Promise((resolve, reject) => {
        request('http://gtfs.openov.nl/gtfs-rt/gtfs-openov-nl.zip')
          .on('error', function(err) {
            reject(err)
          })
          .on('end', () => {
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
      // console.log('step 1')
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