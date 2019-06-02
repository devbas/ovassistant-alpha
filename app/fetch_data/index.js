const http = require('http');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

const urls = {
    verhiclePostions: 'http://gtfs.ovapi.nl/nl/vehiclePositions.pb',
    alerts: 'http://gtfs.ovapi.nl/nl/alerts.pb',
    tripUpdates: 'http://gtfs.ovapi.nl/nl/tripUpdates.pb',
    trainUpdates: 'http://gtfs.ovapi.nl/nl/trainUpdates.pb'
}

const httpRequest = async (url) => {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const { statusCode } = res;
    
      let error;
      if (statusCode !== 200) {
        error = new Error('Request Failed.\n' +
                          `Status Code: ${statusCode}`);
      } 
      if (error) {
        console.error(error.message);
        // consume response data to free up memory
        res.resume();
        return;
      }
    
      res.setEncoding(null);
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        resolve(rawData)
      });
    }).on('error', (e) => {
      console.error(`Got error: ${e.message}`);
    });

  });
}
exports.handler = async (event, ctx) => {

  for (const urlKey in urls) {
    if (!urls.hasOwnProperty(urlKey)) continue;

    const url = urls[urlKey];

    const response = await httpRequest(url);
    console.log('response', response)
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(response.body);

    console.log(feed)

    break;

  }

}