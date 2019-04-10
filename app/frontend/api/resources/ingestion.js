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

  try {

    // var stream = fs.createReadStream(path.resolve("tmp/csv/", "snake_case_users.csv"))

    // open uploaded file
    var parser = csv.fromPath(req.file.path)
      // .validate(function(row) {
      //   return (row.id % 2) === 0;
      // })
      .on("data", function (data) {
        console.log('process')
        const userId = data[3].match(/\d/g).join("");
        parser.pause()
        axios.get(`http://scoring:8001/api/classify/location/?lon=${data[0]}&lat=${data[1]}&datetime=${data[2]}&userId=${userId}`)
          .then(function(response) {
            if(response.data.matches && response.data.matches.vehicle_id) {
              if(response.data.matches.vehicle_id === data[3]) {
                fileValidationResult.push({
                  success: true, 
                  originalVehicleId: data[3], 
                  classifiedVehicleId: response.data.matches.vehicle_id
                })
              } else {
                fileValidationResult.push({
                  success: false, 
                  originalVehicleId: data[3], 
                  classifiedVehicleId: response.data.matches.vehicle_id
                })
              }
            } else {
              if(data[4] === 1) {
                fileValidationResult.push({
                  success: false, 
                  originalVehicleId: data[3], 
                  classifiedVehicleId: false 
                })
              } else {
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
        res.send({ fileValidationResult: fileValidationResult })
        //process "fileRows" and respond
      })
  } catch(e) {
    console.log('e: ', e)
    res.send(500)
  }
})

module.exports = router