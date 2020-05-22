var fixTime = function(time) {
  if (time.match(/^24:/)) {
    return '00'+time.slice(2)
  }

  if (time.match(/^25:/)) {
    return '01'+time.slice(2)
  }

  if (time.match(/^26:/)) {
    return '02'+time.slice(2)
  }

  if (time.match(/^27:/)) {
    return '03'+time.slice(2)
  }

  if (time.match(/^28:/)) {
    return '04'+time.slice(2)
  }

  if (time.match(/^29:/)) {
    return '05'+time.slice(2)
  }

  if (time.match(/^30:/)) {
    return '06'+time.slice(2)
  }

  if (time.match(/^31:/)) {
    return '07'+time.slice(2)
  }

  return timeå
}

module.exports = { 
  fixTime: fixTime
}