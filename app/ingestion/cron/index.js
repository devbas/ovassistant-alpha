'use strict'

const cron = require('node-cron')
// const admZip = require('adm-zip')
const decompress = require('decompress')
const request = require('request')
// const request = require('request-promise-native')
const fs = require('fs')
const { Client } = require('pg')
var copyFrom = require('pg-copy-streams').from;
// const csv = require('csv-parser')

const config = require('../config/config')

const ingestLatestGTFS = async () => {

  const zipFile = 'gtfs-openov-nl.zip'
  const extractEntryTo = ''
  const outputDir = './tmp/'

  try {

    console.log('start downloading')
    const GTFSArchiveResponse = new Promise((resolve, reject) => {
      
      console.log('Starting downloading GTFS NL')
      request('http://gtfs.openov.nl/gtfs-rt/gtfs-openov-nl.zip')
        .on('error', function(err) {
          reject(err)
        })
        .on('end', () => {
          console.log('Finished downloading GTFS NL')
          resolve()
        })
        .pipe(fs.createWriteStream(zipFile))
    })

    GTFSArchiveResponse.then(async () => {
      await decompress(zipFile, 'tmp').then(files => {
        fs.unlink(zipFile)
        console.log('unlinked!')
      })

      const client = new Client(config.pg)
      await client.connect()

      await client.query('TRUNCATE temp_shapes')
      console.log(new Date(), ' Temp Shapes table truncated')

      const ingestShapesResponse = new Promise((resolve, reject) => {
        console.log(new Date(), ' Temp Shapes ingestion started')
        let stream = client.query(copyFrom('COPY temp_shapes (shape_id,shape_pt_sequence,shape_pt_lat,shape_pt_lon,shape_dist_traveled) FROM STDIN CSV HEADER'))
        let fileStream = fs.createReadStream('./tmp/shapes.txt')
        fileStream.on('error', (err) => {
          reject(err)
        });
        stream.on('error', (err) => {
          reject(err)
        });
        stream.on('end', () => {
          resolve()
        });
        fileStream.pipe(stream);
      })

      ingestShapesResponse
        .then(async () => {

          console.log(new Date(), ' Truncate trajectories table')
          await client.query('TRUNCATE trajectories')

          console.log(new Date(), ' Creating Trajectory linestrings')
          const query = `INSERT INTO trajectories (shape_id, geom)
                        SELECT shape_id, ST_MakeLine(ST_MakePoint(shape_pt_lon::double precision, shape_pt_lat::double precision) ORDER BY shape_id, shape_pt_sequence ASC) As geom
                        FROM temp_shapes
                        GROUP BY shape_id`
          
          await client.query(query)

          console.log(new Date(), ' Trajectory linestrings generated')
          
          fs.readdirSync(outputDir).forEach(function(file,index){
            const curPath = outputDir + '/' + file 
            fs.unlinkSync(curPath);
          })
          fs.rmdirSync(outputDir);

          console.log(new Date(), ' Finished ingestion')
        })
        .catch((err) => {
          console.log('err: ', err)
        })

    })

  } catch(e) {
    console.log('e: ',e)
  }
}  

ingestLatestGTFS() 

const task = cron.schedule('0 0 3 * * *', () => {
  ingestLatestGTFS()
}, {
  scheduled: false, 
  timezone: "Europe/Amsterdam"
})

// Download GTFS

// Insert into the Postgis trajectories table, with the timestamp included 