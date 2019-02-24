var express         = require('express');  
var passport        = require('passport');
require('../../modules/passport.js')(passport);

var router = express.Router(); 

router.post('/signup', function(req, res, next) {
  passport.authenticate('local-signup', function(err, user, info) {
    if(!err && user) {
      res.redirect('/developer')
    } else {
      res.send(err)
    }
  })(req, res, next)
  console.log('lets signup!');
})

router.post('/login', passport.authenticate('local-login'), function(req, res, next) {
  res.redirect('/developer')
})

module.exports = router