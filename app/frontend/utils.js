var utils = {}

utils.isLoggedIn = function(req, res, next) {
  if(req.isAuthenticated()) {
    return next()
  }
  res.sendStatus(401)
}

module.exports = utils 