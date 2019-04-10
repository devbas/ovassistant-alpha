const express        = require('express');  
const app            = express();   
const Sentry         = require('@sentry/node');
const _              = require('lodash');
const cors           = require('cors');             
const bodyParser     = require('body-parser');
const matchCalculationController = require('./controllers/calculate'); 
const scoringController = require('./controllers/scoring');
const redisClientPersist = require('./redis-client-persist');
const fs = require('fs');

Sentry.init({ dsn: 'https://39c9c5b61e1d41eb93ba664950bd3416@sentry.io/1339156' });

app.use(Sentry.Handlers.requestHandler());
app.use(cors())
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());   

var port = process.env.PORT || 8001;
var router = express.Router();

router.use((req, res, next) => {
  // do logging
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  console.log('Something is happening.');
  next(); 
});

router.get('/classify/location', async (req, res) => {
  const data = req.query
  
  if(data.userId) {
    data.userId = data.userId
  }

  if(data.datetime) {
    data.datetime = parseInt(data.datetime)
  }

  if(data.lat) {
    data.lat = parseFloat(data.lat)
  }

  if(data.lon) {
    data.lon = parseFloat(data.lon) 
  }

  try {
    const { user, vehicleCandidates, matches } = await matchCalculationController.getVehicleCandidates(data)
    // const response = await matchCalculationController.travelSituationRouter({ 
    //   vehicleContext: vehicleCandidates, 
    //   matches: matches, 
    //   userData: data 
    // })
    res.status(200).send({ userData: data, matches: matches, vehicleContext: vehicleCandidates, user: user})
  } catch(err) {
    // console.log('err: ', err)
    res.status(500).send({ error: JSON.stringify(err) })
    Sentry.captureException(err)
  }

})

// In progress: 
router.get('/scoring', async (req, res) => {
  console.log('he')
  const data = req.query 

  if(data.userId) {
    data.userId = parseInt(data.userId) 
  }

  if(data.datetime) {
    data.datetime = parseInt(data.datetime) 
  }

  if(data.lat) {
    data.lat = parseFloat(data.lat) 
  }

  if(data.lon) {
    data.lon = parseFloat(data.lon) 
  }

  try {
    await scoringController.scoreDataPoint(data)
  } catch(err) {
    console.log('err: ', err)
  }
})

router.get('/feedback', async (req, res) => {
  res.status(200).send({ message: 'OK' })
})

router.get('/shapes-to-redis', (req, res) => {
  const { once } = require('events');
  const { createReadStream } = require('fs');
  const { createInterface } = require('readline');
  const redisShapeStore = require('./redis-shape-store');

  async function processLineByLine() {
    try {
      const rl = createInterface({
        input: createReadStream('./shapes.txt'),
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        // Process the line.
        const shape = line.split(',')
        if(!line.includes('shape_id')) { // Hacky way of skipping the first line
          redisShapeStore.geoadd(shape[0], shape[3], shape[2], `${shape[0]}:${shape[1]}:${shape[4]}`)
        }
      });

      await once(rl, 'close');

      console.log('File processed.');
    } catch (err) {
      console.error(err);
    }
  }

  processLineByLine()
})



router.get('/generate-sample', async (req, res) => {

  const response = await redisClientPersist.zrange('items', 1000, 2000)
  const file = fs.createWriteStream('sample.csv');

  file.on('error', function(err) { console.log('error writing to file: ', err) });
  console.log('total length: ', response[0])
  // let i = 0; 

  for(let i = 0; i < response.length; i++) {
    
    try {
      const coordinates = await redisClientPersist.geopos('items', response[i])
      console.log('coordinates: ', coordinates)
      const datetime = response[i].substring(response[i].lastIndexOf(':') + 1, response[i].length);
      
      let vehicle = response[i].substring(0, response[i].lastIndexOf(":") + 1);
      vehicle = vehicle.substring(0, vehicle.length-1)

      if(datetime !== 'latest') {
        const csvRow = [...coordinates[0], datetime, vehicle]
        file.write(csvRow.join(',') + '\n');
      }
    } catch(e) {
      console.log('erroer: ', e, typeof(response[i]))
    }
  }

  file.end();

  res.send('OK')

})
 
router.get('/*', (req, res) => {
  res.json({ message: '200' });   
});

app.use(Sentry.Handlers.errorHandler());
// Optional fallthrough error handler
app.use(function onError(err, req, res, next) {
  // The error id is attached to `res.sentry` to be returned
  // and optionally displayed to the user for support.
  res.statusCode = 500;
  res.end(res.sentry + '\n');
});

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);
app.set('view engine', 'jade'); 

app.listen(port);
console.log('servert listening on: ', port);