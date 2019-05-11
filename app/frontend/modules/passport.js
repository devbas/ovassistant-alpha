var LocalStrategy   = require('passport-local').Strategy;
var database        = require('../database');
var bcrypt          = require('bcrypt');
var uuidv4          = require('uuid/v4');
var utils           = require('../utils');
var config          = require('../config');

var saltRounds = 20;

module.exports = function(passport) {
  passport.serializeUser(function(user, done) {
    done(null, user.identifier);
  });

  passport.deserializeUser(function(identifier, done) {
    database.query('SELECT * FROM organisation WHERE identifier = ?', [identifier], function(err, organisation) {
      
      if(err) {
        done(err) 
      } else if(organisation.length < 1) {
        done(false, null) 
      } else {
        done(false, organisation[0])
      }

    })
  });

  passport.use('local-signup', new LocalStrategy({
    // by default, local strategy uses username and password, we will override with email
    usernameField : 'email',
    passwordField : 'password',
    passReqToCallback : true // allows us to pass back the entire request to the callback
  },
  function(req, email, password, done) {
    process.nextTick(function() {
      database.query('SELECT * FROM organisation WHERE email = ?', [email], function(err, organisation) {
        if(err) {
          return done(err) 
        }

        if(organisation.length > 0) {
          return done(null, false, 'This email is already taken.');
        } else {
          bcrypt.genSalt(saltRounds, function(err, salt) {
            if(err) return done(err)

            bcrypt.hash(password, salt, function(err, hash) {
              if(err) return done(err) 

              var created = new Date()
              var identifier = uuidv4()
              database.query('INSERT INTO organisation SET `email` = ?, `password` = ?, `created` = ?, `identifier` = ?', [email, hash, created, identifier], function(err, result) {
                if(err) return done(err)

                return done(null, { email: email, created: created, identifier: identifier })
              })
            })
          })
        }

      })
    })
  }))

  passport.use('local-login', new LocalStrategy({
    usernameField: 'email', 
    passwordField: 'password', 
    passReqToCallback: true
  }, function(req, email, password, done) {

    database.query('SELECT * FROM organisation WHERE email = ? LIMIT 0,1', [email], function(err, organisation) {
      if(err) {
        return done(err) 
      }

      if(organisation.length < 1) {
        return done(null, false, 'No user found')
      }

      bcrypt.compare(password, organisation[0].password, function(err, isMatch) {
        if(err) return done(err) 
        if(!isMatch) return done(null, false, 'Wrong email or password');

        return done(null, organisation[0])
      })
    })
  }))

}