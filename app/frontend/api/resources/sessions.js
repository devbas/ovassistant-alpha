var express         = require('express');  
var passport        = require('passport');
// require('../../modules/passport.js');

var router = express.Router(); 

router.post('/signup', function(req, res, next) {
  console.log('lets signup!');
})

router.post('/login', function(req, res, next) {
  console.log('lets login!');
})

module.exports = router