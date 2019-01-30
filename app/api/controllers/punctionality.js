const redis = require("redis");

const redisPunctionalityClient = redis.createClient({
  url: process.env.REDIS_PUNCTIONALITY_URL || 'redis://redis/1'
})

const redisPunctionality = {
  del: promisify(redisPunctionalityClient.del).bind(redisPunctionalityClient),
  get: promisify(redisPunctionalityClient.get).bind(redisPunctionalityClient), 
  set: promisify(redisPunctionalityClient.set).bind(redisPunctionalityClient), 
  geopos: promisify(redisPunctionalityClient.geopos).bind(redisPunctionalityClient), 
  geoadd: promisify(redisPunctionalityClient.geoadd).bind(redisPunctionalityClient), 
  zscan: promisify(redisPunctionalityClient.zscan).bind(redisPunctionalityClient), 
  zrem: promisify(redisPunctionalityClient.zrem).bind(redisPunctionalityClient),
  send_command: promisify(redisPunctionalityClient.send_command).bind(redisPunctionalityClient), 
  flushall: () => {
    redisPunctionalityClient.flushall((err) => {
      console.log('flushAll: ', err)
    })
  }
}

const calculatePunctionality = async (data, nextStops) => {
  // const punctionalityId = data.routeId + ':' + data.serviceId + ':' + data.dayOfWeek + ':' + data.hourOfDay + ':' + data.stopId

  // const historic = redisPuntionality.get(punctionalityId)

  // 
}