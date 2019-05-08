var express         = require('express');  
var database        = require('../../database');
var utils           = require('../../utils');
var uuidv4          = require('uuid/v4');

var router = express.Router(); 

router.post('/create', function(req, res) {

  try {
    if(!req.body.organisationId) {
      throw { 'message': 'Make sure to send the organisationId', 'status': 500 }
    }

    database.query('SELECT * FROM organisation WHERE identifier = ?', req.body.organisationId, function(err, organisation) {
      if(err) throw { 'message': 'Something went wrong on our end, try again later.', 'status': 500 }

      if(organisation.length === 0) {
        throw { 'message': 'Organisation not found.', 'status': 401 }
      }

      database.query('SELECT COUNT(*) AS user_amount FROM user WHERE organisation_id = ?', req.body.organisationId, function(err, totalUsers) {
        if(err) throw { 'message': 'Something went wrong on our end, try again later.', 'status': 500 }

        var maxUsers = parseInt(organisation[0].max_users)
        var totalUsers = parseInt(totalUsers[0].user_amount)

        if(maxUsers > totalUsers) {
          // Create new user account
        }
      })
      
    })
  } catch(e) {
    res.status(e.status).send(e)
  }


  // // Check the amount of users a organisation has 
  // if(req.body.organisationId) {
  //   database.query('SELECT COUNT(*) AS user_amount FROM user WHERE organisation_id = ?', req.user.organisation_id, function(err, totalUsers) {
  //     database.query('SELECT max_users FROM organisation WHERE organisation_id = ?', req.user.organisation_id, function(err, organisation) {
  //       if(err) res.send(500) 

  //       var maxUsers = parseInt(organisation[0].max_users) 
  //       var totalUsers = parseInt(totalUsers[0].user_amount)

  //       if(maxUsers > totalUsers) {
  //         var identifier = uuidv4()
  //         database.query('INSERT INTO user SET organisation_id = ?, name = ?, identifier = ?', [req.user.organisation_id, req.body.name, identifier], function(err, insertedUser) {
  //           if(err) { 
  //             res.send(500) 
  //           } else {
  //             res.send({ identifier: identifier, name: req.body.name })
  //           } 
  //         })
  //       }
  //     })
  //   })
  // }
})

module.exports = router