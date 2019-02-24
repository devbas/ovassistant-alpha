var express         = require('express');  
var passport        = require('passport');
// require('../../modules/passport.js');

var router = express.Router(); 

router.post('/dev/sessions', function(req, res, next) {
  console.log('lets charge!');
})

module.exports = router