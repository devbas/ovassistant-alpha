const express        = require('express');  
const app            = express();   
const Sentry         = require('@sentry/node');
const _              = require('lodash');
const cors           = require('cors');             
const bodyParser     = require('body-parser');
const matchCalculationController = require('./controllers/calculate'); 
const scoringController = require('./controllers/scoring');

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
  console.log('data: ', data)
  try {
    const { user, vehicleCandidates, matches } = await matchCalculationController.getVehicleCandidates(data)
    const response = await matchCalculationController.travelSituationRouter({ 
      vehicleContext: vehicleCandidates, 
      matches: matches, 
      userData: data 
    })
    res.status(200).send({...response, user: user})
  } catch(err) {
    // console.log('err: ', err)
    res.status(500).send({ error: JSON.stringify(err) })
    Sentry.captureException(err)
  }

})

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

// router.get('/')
 
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