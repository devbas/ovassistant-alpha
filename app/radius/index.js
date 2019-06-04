const redisClient = require('./redis');

exports.handler = (event) => {
  const {
    queryStringParameters
  } = event;

  const {
    lat,
    long,
    limit
  } = queryStringParameters;

  const data = await redisClient.georadius('items', long, lat, 99999, 'km', 'WITHDIST', 'COUNT', (limit ? limit : 20))

  return {
    statusCode: 200,
    body: JSON.stringify(data)
  }
}