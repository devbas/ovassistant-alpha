const redisClient = require('./redis');

exports.handler = async (event) => {
  const {
    queryStringParameters
  } = event;

  if (!queryStringParameters) {
    return {
      statusCode: 501,
      body: JSON.stringify({
        message: 'No query string parameters'
      })
    }    
  }

  const {
    lat,
    long,
    limit
  } = queryStringParameters;

  if (!lat || !long) {
    return {
      statusCode: 501,
      body: JSON.stringify({
        message: 'Missing lat or long'
      })
    }    
  }

  const data = []

  const vehicles = await redisClient.georadius('items', long, lat, 99999, 'km', 'WITHDIST', 'COUNT', (limit ? limit : 20))

  for (const vehicleId in vehicles) {
    if (!vehicles.hasOwnProperty(vehicleId)) continue;

    const vehicle = vehicles[vehicleId];

    let vehicleData = await redisClient.get(vehicle[0]);
    vehicleData.distance = vehicle[1]
    data.push(JSON.parse(vehicleData))
  }

  return {
    statusCode: 200,
    body: JSON.stringify(data)
  }
}