var express         = require('express');  
var database        = require('../../database');
var utils           = require('../../utils');
var uuidv4          = require('uuid/v4');

var router = express.Router(); 

router.get('/', utils.isLoggedIn, function(req, res) {
  database.query('SELECT * FROM user WHERE organisation_id = ? LIMIT 0,100', [req.user.organisation_id], function(err, users) {
    if(err) {
      res.send(err)
    } else {
      res.send(users)
    }
  })
})

router.get('/organisation-id', utils.isLoggedIn, function(req, res) {
  database.query('SELECT * FROM organisation WHERE organisation_id = ?', [req.user.organisation_id], function(err, organisation) {
    if(err) {
      res.send(err)
    } else {
      res.send({ identifier: organisation[0].identifier })
    }
  })
})

router.get('/playground-results', utils.isLoggedIn, function(req, res) {
  database.query('SELECT * FROM dev_playground_results WHERE organisation_id = ?', [req.user.organisation_id], function(err, playgroundResults) {
    if(err) {
      res.send(err) 
    } else {
      res.send({ results: playgroundResults })
    }
  })
})

module.exports = router