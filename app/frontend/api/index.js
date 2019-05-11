var express = require('express');

const router = express.Router(); 

var sessions = require('./resources/sessions');
var users = require('./resources/users');
var ingestion = require('./resources/ingestion');

router.use('/dev/sessions', sessions);
router.use('/user', users);
router.use('/dev/ingestion', ingestion);

module.exports = router;