const express = require('express')
const passport = require('passport')
const utils = require('../../modules/utils')
const jwt = require('jsonwebtoken')
const config = require('../../config/config')
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

router.get('/is-logged-in', passport.authenticate('jwt-login', { session: false }), (req, res) => {
  res.send('Apparently you are logged in!')
})

module.exports = router