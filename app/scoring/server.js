const tracer = require('dd-trace').init({
  analytics: true
});
const express = require('express');  
const app = express();   
const Sentry = require('./sentry.js');
const _ = require('lodash');
const cors = require('cors');             
const bodyParser = require('body-parser');
const fs = require('fs');
const APIRouter = require('./api');
const morgan = require('morgan')
const uuid = require('node-uuid')

morgan.token('id', function getId (req) {
  return req.id
})

function assignId (req, res, next) {
  req.id = uuid.v4()
  next()
}

app.use(Sentry.Handlers.requestHandler());
app.use(cors())
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());   
app.use(assignId)
app.use(morgan(':id :method :url :status :response-time'))

var port = process.env.PORT || 8001;
var router = express.Router();

router.use((req, res, next) => {
  // do logging
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

  if(req.id) {
    Sentry.configureScope(scope => {
      scope.setTag("X-Transaction-ID", req.id);
    })
  }

  next(); 
});

app.use('/api/v1', APIRouter); 

router.get('/feedback', async (req, res) => {
  res.status(200).send({ message: 'OK' })
})

router.get('/*', (req, res) => {
  res.json({ message: '200' });   
});

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

app.use(Sentry.Handlers.errorHandler());
// Optional fallthrough error handler
app.use(function onError(err, req, res, next) {
  // The error id is attached to `res.sentry` to be returned
  // and optionally displayed to the user for support.
  res.statusCode = 500;
  res.end(res.sentry + '\n');
});

app.set('view engine', 'jade'); 

app.listen(port);
console.log('servert listening on: ', port);