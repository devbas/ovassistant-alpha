const express = require('express')
const passport = require('passport')
const utils = require('../../modules/utils')
const jwt = require('jsonwebtoken')
const config = require('../../config/config')
const Sentry = require('../../sentry.js')
const matchCalculationController = require('../../controllers/calculate')
require('../../modules/passport.js')(passport)

var router = express.Router()

router.post('/create', (req, res, next) => {
  console.log('hit it!')
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
          console.log('err: ', err, user)
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

  if(data.location && data.location.coords && data.location.coords.latitude) {
    data.lat = parseFloat(data.location.coords.latitude)
  }

  if(data.location && data.location.coords && data.location.coords.longitude) {
    data.lon = parseFloat(data.location.coords.longitude) 
  }

  try {
    const result = await matchCalculationController.getVehicleCandidates(data)

    res.status(200).send(result)
  } catch(err) {
    res.status(500).send({ error: JSON.stringify(err) })
    Sentry.captureException(err)
  }
})

router.get('/context', passport.authenticate('jwt-login', { session: false }), (req, res) => {

})

module.exports = router