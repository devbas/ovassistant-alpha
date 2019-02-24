var express = require('express');

const router = express.Router(); 

var sessions = require('./resources/sessions');

router.use('/dev/sessions', sessions);

module.exports = router;