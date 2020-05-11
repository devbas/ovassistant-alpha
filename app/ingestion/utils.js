const dateFunctions = require("date-fns")

var toCartesian = function(lat, lng, callback) {
    var R = parseFloat(6731000);
    var radians_per_degree = 0.017453292519943295;

    var x = R * Math.sin(lat * radians_per_degree) * Math.cos(lng * radians_per_degree);
    var y = R * Math.sin(lat * radians_per_degree) * Math.sin(lng * radians_per_degree);
    var z = R * Math.cos(lat * radians_per_degree); 

    //console.log('original lat,lon: ', lat, ' ', lng, '    backpropagate: ', );

    callback({ x: x, y: y, z: z})
}

var euclideanDistance = function(a, b) {
    x1 = a.x; 
    x2 = b.x; 

    y1 = a.y; 
    y2 = b.y; 

    return Math.sqrt(Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2));
}

var X0 = 155E3
  , Y0 = 463E3
  , lat0 = 52.1551744
  , lng0 = 5.38720621
  , latpqK = [];
for (i = 1; 12 > i; i++)
    latpqK[i] = [];
latpqK[1].p = 0;
latpqK[1].q = 1;
latpqK[1].K = 3235.65389;
latpqK[2].p = 2;
latpqK[2].q = 0;
latpqK[2].K = -32.58297;
latpqK[3].p = 0;
latpqK[3].q = 2;
latpqK[3].K = -0.2475;
latpqK[4].p = 2;
latpqK[4].q = 1;
latpqK[4].K = -0.84978;
latpqK[5].p = 0;
latpqK[5].q = 3;
latpqK[5].K = -0.0665;
latpqK[6].p = 2;
latpqK[6].q = 2;
latpqK[6].K = -0.01709;
latpqK[7].p = 1;
latpqK[7].q = 0;
latpqK[7].K = -0.00738;
latpqK[8].p = 4;
latpqK[8].q = 0;
latpqK[8].K = 0.0053;
latpqK[9].p = 2;
latpqK[9].q = 3;
latpqK[9].K = -3.9E-4;
latpqK[10].p = 4;
latpqK[10].q = 1;
latpqK[10].K = 3.3E-4;
latpqK[11].p = 1;
latpqK[11].q = 1;
latpqK[11].K = -1.2E-4;
var lngpqL = [];
for (i = 1; 13 > i; i++)
    lngpqL[i] = [];
lngpqL[1].p = 1;
lngpqL[1].q = 0;
lngpqL[1].K = 5260.52916;
lngpqL[2].p = 1;
lngpqL[2].q = 1;
lngpqL[2].K = 105.94684;
lngpqL[3].p = 1;
lngpqL[3].q = 2;
lngpqL[3].K = 2.45656;
lngpqL[4].p = 3;
lngpqL[4].q = 0;
lngpqL[4].K = -0.81885;
lngpqL[5].p = 1;
lngpqL[5].q = 3;
lngpqL[5].K = 0.05594;
lngpqL[6].p = 3;
lngpqL[6].q = 1;
lngpqL[6].K = -0.05607;
lngpqL[7].p = 0;
lngpqL[7].q = 1;
lngpqL[7].K = 0.01199;
lngpqL[8].p = 3;
lngpqL[8].q = 2;
lngpqL[8].K = -0.00256;
lngpqL[9].p = 1;
lngpqL[9].q = 4;
lngpqL[9].K = 0.00128;
lngpqL[10].p = 0;
lngpqL[10].q = 2;
lngpqL[10].K = 2.2E-4;
lngpqL[11].p = 2;
lngpqL[11].q = 0;
lngpqL[11].K = -2.2E-4;
lngpqL[12].p = 5;
lngpqL[12].q = 0;
lngpqL[12].K = 2.6E-4;
var XpqR = [];
for (i = 1; 10 > i; i++)
    XpqR[i] = [];
XpqR[1].p = 0;
XpqR[1].q = 1;
XpqR[1].R = 190094.945;
XpqR[2].p = 1;
XpqR[2].q = 1;
XpqR[2].R = -11832.228;
XpqR[3].p = 2;
XpqR[3].q = 1;
XpqR[3].R = -114.221;
XpqR[4].p = 0;
XpqR[4].q = 3;
XpqR[4].R = -32.391;
XpqR[5].p = 1;
XpqR[5].q = 0;
XpqR[5].R = -0.705;
XpqR[6].p = 3;
XpqR[6].q = 1;
XpqR[6].R = -2.34;
XpqR[7].p = 1;
XpqR[7].q = 3;
XpqR[7].R = -0.608;
XpqR[8].p = 0;
XpqR[8].q = 2;
XpqR[8].R = -0.008;
XpqR[9].p = 2;
XpqR[9].q = 3;
XpqR[9].R = 0.148;
var YpqS = [];
for (i = 1; 11 > i; i++)
    YpqS[i] = [];
YpqS[1].p = 1;
YpqS[1].q = 0;
YpqS[1].S = 309056.544;
YpqS[2].p = 0;
YpqS[2].q = 2;
YpqS[2].S = 3638.893;
YpqS[3].p = 2;
YpqS[3].q = 0;
YpqS[3].S = 73.077;
YpqS[4].p = 1;
YpqS[4].q = 2;
YpqS[4].S = -157.984;
YpqS[5].p = 3;
YpqS[5].q = 0;
YpqS[5].S = 59.788;
YpqS[6].p = 0;
YpqS[6].q = 1;
YpqS[6].S = 0.433;
YpqS[7].p = 2;
YpqS[7].q = 2;
YpqS[7].S = -6.439;
YpqS[8].p = 1;
YpqS[8].q = 1;
YpqS[8].S = -0.032;
YpqS[9].p = 0;
YpqS[9].q = 4;
YpqS[9].S = 0.092;
YpqS[10].p = 1;
YpqS[10].q = 4;
YpqS[10].S = -0.054;

var gps2X = function(b, c) {
    var a = 0;
    dlat = 0.36 * (b - lat0);
    dlng = 0.36 * (c - lng0);
    for (i = 1; 10 > i; i++)
        a += XpqR[i].R * Math.pow(dlat, XpqR[i].p) * Math.pow(dlng, XpqR[i].q);
    return X0 + a
}
var gps2Y = function(b, c) {
    var a = 0;
    dlat = 0.36 * (b - lat0);
    dlng = 0.36 * (c - lng0);
    for (i = 1; 11 > i; i++)
        a += YpqS[i].S * Math.pow(dlat, YpqS[i].p) * Math.pow(dlng, YpqS[i].q);
    return Y0 + a
}
var RD2lat = function(b, c) {
    var a = 0;
    dX = 1E-5 * (b - X0);
    dY = 1E-5 * (c - Y0);
    for (i = 1; 12 > i; i++)
        a += latpqK[i].K * Math.pow(dX, latpqK[i].p) * Math.pow(dY, latpqK[i].q);
    return lat0 + a / 3600
}
var RD2lng = function(b, c) {
    var a = 0;
    dX = 1E-5 * (b - X0);
    dY = 1E-5 * (c - Y0);
    for (i = 1; 13 > i; i++)
        a += lngpqL[i].K * Math.pow(dX, lngpqL[i].p) * Math.pow(dY, lngpqL[i].q);
    return lng0 + a / 3600
};

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
  
    return time
}

var makeid = function() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 10; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

const ISO_PERIOD = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/

var durationToSeconds = function(duration) {
  date = new Date()

  duration = duration.trim()
  const matches = ISO_PERIOD.exec(duration)
  if (!matches || duration.length < 3) {
    throw new TypeError(`invalid duration: "${duration}". Must be an ISO 8601 duration. See https://en.wikipedia.org/wiki/ISO_8601#Durations`)
  }

  const prefix = matches[1] === "-" ? "sub" : "add"
  const then = ["Years", "Months", "Weeks", "Days", "Hours", "Minutes", "Seconds"].reduce((result, part, index) => {
    const value = matches[index+2] // +2 for full match and sign parts
    return value ? dateFunctions[prefix + part](result, value) : result
  }, date)

  return (then.getTime() - date.getTime()) / 1000
}

module.exports = { 
    toCartesian: toCartesian, 
    gps2X: gps2X, 
    gps2Y: gps2Y, 
    RD2lat: RD2lat, 
    RD2lng: RD2lng,
    fixTime: fixTime, 
    makeid: makeid, 
    durationToSeconds: durationToSeconds
}