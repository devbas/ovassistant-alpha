const express = require('express')
const passport = require('passport')
const utils = require('../../modules/utils')
const jwt = require('jsonwebtoken')
const config = require('../../config/config')
const Sentry = require('@sentry/node')
const matchCalculationController = require('../../controllers/calculate')
require('../../modules/passport.js')(passport)

var router = express.Router()

router.post('/create', (req, res, next) => {

  req.body.username = utils.makeid(10)
  req.body.password = utils.makeid(15)

  passport.authenticate('device-register', (err, user, info) => {
    if(err) {
      if(err.status) {
        res.status(err.status).send(err)
      } else {
        res.status(500).send(err)
      }
    } else if(user) {
      req.login(user, (err) => {
        if(err) {
          res.status(500).send({ 'message': 'Something went wrong on our end, try again later.', 'status': 500 })
        } else {
          const token = jwt.sign({ user_id: user.user_id, organisation_id: user.organisation_id, name: user.name }, config.jwtSecret)
          res.status(200).send({ 
            auth: true, 
            token: token 
          })
        }
      })
    } else {
      res.status(500).send({ 'message': 'Something went wrong on our end, try again later.', 'status': 500 })
    }
  })(req, res, next)
})

router.post('/score', passport.authenticate('jwt-login', { session: false }), async (req, res) => {
  const data = req.body

  data.userId = req.user.user_id

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
    const { vehicleCandidates, matches } = await matchCalculationController.getVehicleCandidates(data)
    // const response = await matchCalculationController.travelSituationRouter({ 
    //   vehicleContext: vehicleCandidates, 
    //   matches: matches, 
    //   userData: data 
    // })
    res.status(200).send({ matches: matches, vehicleContext: vehicleCandidates })
  } catch(err) {
    res.status(500).send({ error: JSON.stringify(err) })
    Sentry.captureException(err)
  }
})

router.get('/context', passport.authenticate('jwt-login', { session: false }), (req, res) => {

})

module.exports = router