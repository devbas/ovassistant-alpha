const request = require('request');
const progress = require('request-progress');
const AWS = require('aws-sdk')
const s3 = new AWS.S3()

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

exports.handler = (event, ctx, callback) => {
  console.log('event_data', event)
  console.log('upload_to', process.env.gtfs_bucket)
  const options = {
    uri: event.url,
    encoding: null
  };
  console.log('Downloading started')

  progress(request(options, (err, response, body) => {
    console.log('Uploading started')

    var params = {
      Bucket: process.env.gtfs_bucket,
      Key   : 'uploads/'+event.name,
      Body  : body,   
    }

    var req = s3.makeRequest('putObject', params);
    req.on('httpUploadProgress', function(progress) {
      console.log('Uploading...', progress)
    });
    req.send(function(err, data) {
      callback(err, data)
    })
  }), {
    // throttle: 2000,                    // Throttle the progress event to 2000ms, defaults to 1000ms
    // delay: 1000,                       // Only start to emit after 1000ms delay, defaults to 0ms
    // lengthHeader: 'x-transfer-length'  // Length header to use, defaults to content-length
  })
  .on('progress', function (state) {
      // The state is an object that looks like this:
      // {
      //     percent: 0.5,               // Overall percent (between 0 to 1)
      //     speed: 554732,              // The download speed in bytes/sec
      //     size: {
      //         total: 90044871,        // The total payload size in bytes
      //         transferred: 27610959   // The transferred payload size in bytes
      //     },
      //     time: {
      //         elapsed: 36.235,        // The total elapsed seconds since the start (3 decimals)
      //         remaining: 81.403       // The remaining seconds to finish (3 decimals)
      //     }
      // }
      if (state.speed) {
        console.log('Downloading...', parseFloat(state.percent * 100).toFixed(2) + '%', Math.round(state.time.remaining) + ' seconds to go', '('+formatBytes(state.speed) + '/sec)');
      }
  })
  .on('error', function (err) {
    throw new Error(err)
  })  
}




