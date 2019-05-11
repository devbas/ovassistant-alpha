const LocalStrategy = require('passport-local').Strategy
const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt
const passport = require('passport')
const database = require('./database')
const bcrypt = require('bcrypt')
const config = require('../config/config')

const saltRounds = 10

module.exports = (passport) => {
  passport.use('device-register', new LocalStrategy(
    {
      usernameField: 'username',
      passwordField: 'password', 
      passReqToCallback: true
    }, 
    async (req, username, password, done) => {

      const issuer = req.body.organisationId

      if(!issuer) {
        throw { 'message': 'Provide the field organisationId for the organisation.', 'status': 401}
      }

      database.query('SELECT * FROM organisation WHERE identifier = ?', issuer)
        .then(organisation => {
          if(organisation.length === 0) {
            throw { 'message': 'Incorrect identifier for the organisation.', 'status': 401 }
          }

          return organisation[0]
        })
        .then(organisation => {
          return database.query('SELECT COUNT(*) AS user_amount FROM user WHERE organisation_id = ?', organisation.organisation_id)
            .then(totalUsers => {
              return { 'totalUsers': totalUsers, 'organisation': organisation }
            })
        })
        .then(({ totalUsers, organisation }) => {
          const maxUsers = parseInt(organisation.max_users)
          const totalUserAmount = parseInt(totalUsers[0].user_amount)
          
          if(maxUsers > totalUserAmount) {
            return bcrypt.hash(password, saltRounds)
              .then(hashedPassword => {
                return { 'organisation': organisation, 'hashedPassword': hashedPassword }
              })
          } else {
            throw { 'message': 'Maximum amount of accounts reached.', 'status': 401 }
          }
        })
        .then(({ organisation, hashedPassword }) => {
          return database.query('INSERT INTO user SET `name` = ?, `organisation_id` = ?, `password` = ?, `created` = ?', [username, organisation.organisation_id, hashedPassword, new Date()])
        })
        .then(insertedRow => {
          return database.query('SELECT user_id, name, organisation_id, identifier FROM user WHERE user_id = ?', insertedRow.insertId)
        })
        .then(user => {
          return done(false, user[0])
        })
        .catch(err => {
          if(!err.status) {
            return done({ 'message': 'Something went wrong on our end, try again later.', 'status': 500 })
          } else {
            return done(err)
          }
        })
    }
  ))
  
  const opts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken('JWT'),
    secretOrKey: config.jwtSecret
  }
    
  passport.use('jwt-login', new JwtStrategy(opts, 
    (jwt_payload, done) => {
      if(!jwt_payload.user_id) {
        throw { 'message': 'Provide credentials for the user to authenticate.', 'status': 401 }
      }

      database.query('SELECT user_id, name, organisation_id, identifier FROM user WHERE user_id = ?', jwt_payload.user_id)
        .then(user => {
          if(user.length === 0) {
            throw { 'message': 'Incorrect credentials provided.', 'status': 401 }
          }

          return done(false, user[0])
        })
        .catch(err => {
          if(!err.status) {
            return done({ 'message': 'Something went wrong on our end, try again later.', 'status': 500 })
          } else {
            return done(err) 
          }
        })
    }
  ))

}