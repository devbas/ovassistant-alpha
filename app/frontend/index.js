var express = require('express');
var path = require('path');
var logger = require('morgan'); 
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var passport = require('passport');
var session = require('express-session');
var pug = require('pug');
var APIRouter = require('./api');
var utils = require('./utils');

var app = express(); 

app.use(logger('dev')); 
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));
app.use(cookieParser());
app.set('view engine', 'pug');

app.use(session({
  secret: "KsgY6qqGX06L6hO492tZwZEU+romYEVR7YycWn4lV6I=",
  resave: true,
  saveUninitialized: true 
}));

app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
require('./modules/passport');
app.use('/api/v1', APIRouter); 

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, '/client', 'index.html'));
})

app.get('/developer', utils.isLoggedIn, function(req, res) {
  res.sendFile(path.join(__dirname, '/client', 'developer.html'));
})

app.use(express.static(path.join(__dirname, './client/')));

app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  // res.locals.message = err.message;
  // res.locals.error = req.app.get('env') === 'development' ? err : {};

  console.log('err: ', err); 
  // render the error page
  res.status(err.status || 500);
  res.send('error');
}); 

app.disable('x-powered-by');

module.exports = app;