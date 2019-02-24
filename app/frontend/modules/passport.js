var LocalStrategy   = require('passport-local').Strategy;
var passport        = require('passport');
var database        = require('../database');
var bcrypt          = require('bcrypt');
var uuidv4          = require('uuid/v4');

var saltRounds = 10;

module.exports = function(passport) {
  passport.serializeUser(function(user, done) {
    console.log('serialize');
    done(null, user.identifier);
  });

  passport.deserializeUser(function(identifier, done) {
    console.log('deserializeUser', identifier);
    database.query('SELECT * FROM organisation WHERE identifier = ?', [identifier], function(err, organisation) {
      
      if(err) {
        done(err) 
      } else if(organisation.length < 1) {
        done(false, null) 
      } else {
        done(false, organisation)
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
      console.log('blabla', email);
      database.query('SELECT * FROM organisation WHERE email = ?', [email], function(err, organisation) {
        if(err) {
          console.log('err: ', err); 
          return done(err) 
        }

        if(organisation.length > 0) {
          console.log('organisation found', organisation); 
          return done(null, false, 'This email is already taken.');
        } else {
          console.log('new organisation'); 
          bcrypt.genSalt(saltRounds, function(err, salt) {
            if(err) return done(err)

            bcrypt.hash(password, salt, function(err, hash) {
              if(err) return done(err) 

              var created = new Date()
              var identifier = uuidv4()
              database.query('INSERT INTO organisation SET `email` = ?, `password` = ?, `created` = ?, `identifier` = ?', [email, hash, created, identifier], function(err, result) {
                if(err) return done(err)

                return done(null, { email: email, created: created, password: hash })
              })
            })
          })
        }

      })
      // Users.findOne({ 'local.email': email }, function(err, user) { // Override with MySQL
      //   console.log(err, user);
      //   if (err) {
      //     console.log('err: ', err);
      //     return done(err);
      //   }

      //   if (user) {
      //     console.log('user found', user);
      //     return done(null, false, 'That email is already taken.');
      //   } else {
      //     console.log('new user'); // Override with MySQL
      //     var newUser = new Users();
      //     newUser.local.email    = email;
      //     newUser.local.password = newUser.generateHash(password);
      //     newUser.subscription = 'annual'; 

      //     newUser.save(function(err) { 
      //       if (err) throw err;
            
      //       return done(null, newUser);
      //     });
      //   }
      // })
    })
  }))

  passport.use('local-login', new LocalStrategy({
    usernameField: 'email', 
    passwordField: 'password', 
    passReqToCallback: true
  }, function(req, email, password, done) {
    console.log('deze email: ', email) 

    database.query('SELECT * FROM organisation WHERE email = ? LIMIT 0,1', [email], function(err, organisation) {
      if(err) {
        console.log('err: ', err) 
        return done(err) 
      }

      if(organisation.length < 1) {
        console.log('organisation: ', organisation)
        return done(null, false, 'No user found')
      }

      bcrypt.compare(password, organisation[0].password, function(err, isMatch) {
        console.log(err, isMatch)
        if(err) return done(err) 
        if(!isMatch) return done(null, false, 'Wrong email or password');

        return done(null, organisation[0])
      })
    })
  }))

  // passport.use('local-login', new LocalStrategy({
  //   usernameField: 'email', 
  //   passwordField: 'password', 
  //   passReqToCallback: true
  // }, function(req, email, password, done) {
  //   console.log('blabla', email);



  //   Users.findOne({ 'local.email': email }, function(err, user) { // Override with MySQL
  //     if(err) {
  //       console.log('err: ', err); 
  //       return done(err); 
  //     }

  //     if(!user) {
  //       console.log('no user');
  //       return done(null, false, 'Bummer, no user found!'); 
  //     }

  //     if(!user.validPassword(password)) {
  //       console.log('no password');
  //       return done(null, false, 'Wrong email or password'); 
  //     }

  //     console.log('done here ', err, user);

  //     return done(null, user); 
  //   })
  // })) 

}