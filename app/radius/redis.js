const redis = require('redis');
const { promisify } = require('util');

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost/0'
});

module.exports = {
  del: promisify(redisClient.del).bind(redisClient),
  get: promisify(redisClient.get).bind(redisClient), 
  set: promisify(redisClient.set).bind(redisClient), 
  geopos: promisify(redisClient.geopos).bind(redisClient), 
  georadius: promisify(redisClient.georadius).bind(redisClient), 
  geoadd: promisify(redisClient.geoadd).bind(redisClient), 
  zscan: promisify(redisClient.zscan).bind(redisClient), 
  zrem: promisify(redisClient.zrem).bind(redisClient),
  send_command: promisify(redisClient.send_command).bind(redisClient), 
  flushall: () => {
    redisClient.flushall((err) => {
      console.log('flushAll: ', err)
    })
  }
}