var express         = require('express');  
var database        = require('../../database');
var utils           = require('../../utils');
var multer = require('multer');
var csv = require('fast-csv');
var fs = require('fs');
var path = require('path');
var axios = require('axios');

var upload = multer({ dest: 'tmp/csv/' });
var router = express.Router(); 

router.post('/file', [utils.isLoggedIn, upload.single('file')], function(req, res) {
  const fileRows = [];
  const fileValidationResult = []
  let numberOfRows = 0
  let deviceObject = []
  let accuracy = 0
  let precision = 0
  let recall = 0
  let f1score = 0
  let TP = 0 
  let FP = 0 
  let FN = 0 
  let TN = 0 

  try {

    // var stream = fs.createReadStream(path.resolve("tmp/csv/", "snake_case_users.csv"))

    // open uploaded file
    var parser = csv.fromPath(req.file.path)
      // .validate(function(row) {
      //   return (row.id % 2) === 0;
      // })
      .on("data", function (data) {
        console.log('process')

        numberOfRows = numberOfRows + 1 

        if(deviceObject[data[3]]) {
          deviceObject[data[3]] = deviceObject[data[3]] + 1
        } else {
          deviceObject[data[3]] = 1
        }

        const userId = data[3].match(/\d/g).join("");
        parser.pause()
        axios.get(`http://scoring:8001/api/classify/location/?lon=${data[0]}&lat=${data[1]}&datetime=${data[2]}&userId=${userId}`)
          .then(function(response) {
            if(response.data.matches && response.data.matches.vehicle_id) {
              if(data[3].includes(response.data.matches.vehicle_id)) {
                // True positive
                TP = TP + 1
                fileValidationResult.push({
                  success: true, 
                  originalVehicleId: data[3], 
                  classifiedVehicleId: response.data.matches.vehicle_id
                })
              } else {
                // False positive
                FP = FP + 1
                fileValidationResult.push({
                  success: false, 
                  originalVehicleId: data[3], 
                  classifiedVehicleId: response.data.matches.vehicle_id
                })
              }
            } else {
              // False negative
              FN = FN + 1
              if(data[4] === 1) {
                fileValidationResult.push({
                  success: false, 
                  originalVehicleId: data[3], 
                  classifiedVehicleId: false 
                })
              } else {
                // True Negative
                TN = TN + 1
                fileValidationResult.push({
                  success: true, 
                  originalVehicleId: false, 
                  classifiedVehicleId: false
                })
              }
            }

            parser.resume()
          })
          .catch(function(err) {
            // console.log('error: ', err) 
          })

        // fileRows.push(data); // push each row
      })
      .on("end", function () {
        console.log('done')
        fs.unlinkSync(req.file.path);   // remove temp file

        const standardDeviation = (arr, usePopulation = false) => {
          const mean = arr.reduce((acc, val) => acc + val, 0) / arr.length;
          return Math.sqrt(
            arr.reduce((acc, val) => acc.concat((val - mean) ** 2), []).reduce((acc, val) => acc + val, 0) /
              (arr.length - (usePopulation ? 0 : 1))
          );
        };
        
        console.log('deviceObject: ', deviceObject)
        let values = Object.values(deviceObject)
        let sum = values.reduce((previous, current) => current += previous)
        let avgDatapointsDevice = sum / values.length 
        let stdDatapointsDevice = standardDeviation(values) 
        let precision = TP / (TP + FP)
        let recall = TP / (TP + FN)

        res.send({ 
          fileValidationResult: fileValidationResult, 
          accuracy: (TP + TN) / (TP + TN + FP + FN), 
          numberOfRows: numberOfRows, 
          uniqueDevices: deviceObject.length, 
          avgDatapointsDevice: avgDatapointsDevice,
          stdDatapointsDevice: stdDatapointsDevice,
          precision: precision, 
          recall: recall, 
          f1score: 2 * (precision * recall) / (precision + recall)
        })
        //process "fileRows" and respond
      })
  } catch(e) {
    console.log('e: ', e)
    res.send(500)
  }
})

module.exports = router