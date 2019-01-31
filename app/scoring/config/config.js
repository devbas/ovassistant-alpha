var environment = process.env.NODE_ENV || 'development';

var config = require('./env/' + environment);

config.someEnvAgnosticSetting = true;

// export config
module.exports = config;