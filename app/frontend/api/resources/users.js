var express         = require('express');  
var database        = require('../../database');
var utils           = require('../../utils');
var uuidv4          = require('uuid/v4');

var router = express.Router(); 

router.post('/create', utils.isLoggedIn, function(req, res) {
  // Check the amount of users a organisation has 
  if(req.body.organisationId) {
    database.query('SELECT COUNT(*) AS user_amount FROM user WHERE organisation_id = ?', req.user.organisation_id, function(err, totalUsers) {
      database.query('SELECT max_users FROM organisation WHERE organisation_id = ?', req.user.organisation_id, function(err, organisation) {
        if(err) res.send(500) 

        var maxUsers = parseInt(organisation[0].max_users) 
        var totalUsers = parseInt(totalUsers[0].user_amount)

        if(maxUsers > totalUsers) {
          var identifier = uuidv4()
          database.query('INSERT INTO user SET organisation_id = ?, name = ?, identifier = ?', [req.user.organisation_id, req.body.name, identifier], function(err, insertedUser) {
            if(err) { 
              res.send(500) 
            } else {
              res.send({ identifier: identifier, name: req.body.name })
            } 
          })
        }
      })
    })
  }
})

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