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

  try {

    // var stream = fs.createReadStream(path.resolve("tmp/csv/", "snake_case_users.csv"))

    // open uploaded file
    csv.fromPath(req.file.path)
      // .validate(function(row) {
      //   return (row.id % 2) === 0;
      // })
      .on("data", function (data) {
        
        const userId = data[3].match(/\d/g).join("");
        axios.get(`http://scoring:8001/api/classify/location/?lon=${data[0]}&lat=${data[1]}&datetime=${data[2]}&userId=${userId}`)
          .then(function(response) {
            // console.log('response: ', response.data)
          })
          .catch(function(err) {
            // console.log('error: ', err) 
          })

        fileRows.push(data); // push each row
      })
      .on("end", function () {
        fs.unlinkSync(req.file.path);   // remove temp file
        //process "fileRows" and respond
      })
  } catch(e) {
    console.log('e: ', e)
    res.send(500)
  }
})

module.exports = router