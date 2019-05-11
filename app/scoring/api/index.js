var express = require('express');

const router = express.Router(); 

var device = require('./resources/device');

router.use('/device/', device);

module.exports = router;