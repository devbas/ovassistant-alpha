const express = require('express');  
const app = express();   
const Sentry = require('./sentry.js');
const _ = require('lodash');
const cors = require('cors');             
const bodyParser = require('body-parser');
const redisClientPersist = require('./redis-client-persist');
const fs = require('fs');
const APIRouter = require('./api');

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

  if(req.header('X-Transaction-ID')) {
    Sentry.configureScope(scope => {
      scope.setTag("X-Transaction-ID", req.header('X-Transaction-ID'));
    })
  }

  next(); 
});

app.use('/api/v1', APIRouter); 

router.get('/feedback', async (req, res) => {
  res.status(200).send({ message: 'OK' })
})

// router.get('/shapes-to-redis', (req, res) => {
//   const { once } = require('events');
//   const { createReadStream } = require('fs');
//   const { createInterface } = require('readline');
//   const redisShapeStore = require('./redis-shape-store');

//   async function processLineByLine() {
//     try {
//       const rl = createInterface({
//         input: createReadStream('./shapes.txt'),
//         crlfDelay: Infinity
//       });

//       rl.on('line', (line) => {
//         // Process the line.
//         const shape = line.split(',')
//         if(!line.includes('shape_id')) { // Hacky way of skipping the first line
//           redisShapeStore.geoadd(shape[0], shape[3], shape[2], `${shape[0]}:${shape[1]}:${shape[4]}`)
//         }
//       });

//       await once(rl, 'close');

//       console.log('File processed.');
//     } catch (err) {
//       console.error(err);
//     }
//   }

//   processLineByLine()
// })

// router.get('/generate-sample', async (req, res) => {

//   const response = await redisClientPersist.zrange('items', 1000, 2000)
//   const file = fs.createWriteStream('sample.csv');

//   file.on('error', function(err) { console.log('error writing to file: ', err) });
//   console.log('total length: ', response[0])
//   // let i = 0; 

//   for(let i = 0; i < response.length; i++) {
    
//     try {
//       const coordinates = await redisClientPersist.geopos('items', response[i])
//       console.log('coordinates: ', coordinates)
//       const datetime = response[i].substring(response[i].lastIndexOf(':') + 1, response[i].length);
      
//       let vehicle = response[i].substring(0, response[i].lastIndexOf(":") + 1);
//       vehicle = vehicle.substring(0, vehicle.length-1)

//       if(datetime !== 'latest') {
//         const csvRow = [...coordinates[0], datetime, vehicle]
//         file.write(csvRow.join(',') + '\n');
//       }
//     } catch(e) {
//       console.log('erroer: ', e, typeof(response[i]))
//     }
//   }

//   file.end();

//   res.send('OK')

// })
 
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