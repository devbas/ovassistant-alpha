var utils = {}

utils.isLoggedIn = function(req, res, next) {
  if(req.isAuthenticated()) {
    return next()
  }
  res.sendStatus(401)
}

utils.makeid = function(length) {
  var result           = '';
  var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for ( var i = 0; i < length; i++ ) {
     result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

module.exports = utils 