var express = require('express');

const router = express.Router(); 

var sessions = require('./resources/sessions');
var users = require('./resources/users');
var ingestion = require('./resources/ingestion');
var devices = require('./resources/devices');

router.use('/dev/sessions', sessions);
router.use('/user', users);
router.use('/dev/ingestion', ingestion);
router.use('/device/', devices);

module.exports = router;