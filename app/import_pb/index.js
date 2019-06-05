const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const redis = require('./redis');
const LatLon = require('./movable');
const AWS = require('aws-sdk')
const s3 = new AWS.S3()
const fs = require('fs');
const path = require('path');

const isPersist = process.env.INGESTION_PERSIST || true;

Array.prototype.diff = function(a) {
  return this.filter(function(i) {return a.indexOf(i) < 0;});
};

exports.handler = async (event) => {
  let data = null;

  if (event['Records']) {
    const params = {
      Bucket: event['Records'][0]['s3']['bucket']['name'],
      Key: event['Records'][0]['s3']['object']['key'],
    }

    data = await s3.getObject(params).promise();

    data = data.Body;

  } else {
    console.log('Dowloading example data')
    data = fs.readFileSync(path.join(__dirname, './examples/vehiclePositions.pb'))
  }

  if (!data) {
    throw new Erorr('no data!')
  }

  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(data);

  await redis.flushall()
/*
  const allItems = await redis.zrange('items', 0, -1);

  const allFeedItems = feed.entity.map(entity => entity.id);
  const old = allFeedItems.diff(allItems)

  for (const offset in old) {
    if (!old.hasOwnProperty(offset)) continue;
    
    const key = old[offset];
    console.log('Delete key', key)
    await redis.del(key)
  }
  */
  for (const entityId in feed.entity) {
    if (!feed.entity.hasOwnProperty(entityId)) continue;

    const entity = feed.entity[entityId];
    
    const latestId = `${entity.id}:latest`;

    const {
      vehicle,
      alert,
      tripUpdate,
    } = entity;

    if (vehicle) {
      const {
        position,
        trip
      } = vehicle;

      if (!position) {
        console.log('No position', entity);
        continue;
      }

      const {
        latitude,
        longitude
      } = position;

      const {
        startTime,
        startDate
      } = trip;

      const year = startDate.slice(0,4);
      const month = startDate.slice(4,6);
      const day = startDate.slice(6,8);

      const hour = startTime.slice(0,2)
      if (hour === 24) {
        hour = 00;
      }
      const minute = startTime.slice(3,5)

      const datetime = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
      const datetimeUnix = datetime.getTime() / 1000;

      const row = {
        id: entity.id,
        datetimeUnix,
        latitude: latitude,
        longitude: longitude,
        trip
      }

      /*const vehiclePrevRaw = await redis.get(latestId)

      if (vehiclePrevRaw) {

        const vehiclePrev = JSON.parse(vehiclePrevRaw)
        const vehiclePointPrev = await redis.geopos('items', latestId)
        const prevIdentifier = `${row.id}:${vehiclePrev['datetimeUnix']}`
  
        if (isPersist) {
          await redis.set(prevIdentifier, JSON.stringify(vehiclePrev))
        } else { 
          await redis.set(prevIdentifier, JSON.stringify(vehiclePrev), 'EX', 40)
        }
  
        if (vehiclePointPrev[0]) {
  
          if (isPersist) {
            await redis.geoadd('items', vehiclePointPrev[0][0], vehiclePointPrev[0][1], prevIdentifier)
          } else {
            await redis.geoadd('items', vehiclePointPrev[0][0], vehiclePointPrev[0][1], prevIdentifier)
          }
  
          const prevPoint = new LatLon(vehiclePointPrev[0][1], vehiclePointPrev[0][0])
          const nextPoint = new LatLon(row.latitude, row.longitude)
        
          row.bearing = prevPoint.bearingTo(nextPoint)
          row.speedPerSecond = prevPoint.speedPerSecond(nextPoint, vehiclePrev.datetimeUnix, row.datetimeUnix)
          row.vehiclePrevPoint = prevIdentifier
        } else {
          row.bearing = -1 
          row.speedPerSecond = 0
        }
      } else {
        row.bearing = -1 
        row.speedPerSecond = 0 
      }*/
  
      if (isPersist) {
        await redis.set(latestId, JSON.stringify(row))
        await redis.geoadd('items', row.longitude, row.latitude, latestId)
      } else {
        await redis.set(latestId, JSON.stringify(row), 'EX', 40)
        await redis.geoadd('items', row.longitude, row.latitude, latestId)
      }
    }

    if (alert) {
      const data = await redis.get(latestId);

      if (!data) {
        continue;
      }

      const parsed = JSON.parse(data);

      parsed.alert = alert;

      await redis.set(latestId, JSON.stringify(parsed))
    }

    if (tripUpdate) {
      const { 
        stopTimeUpdate,
      } = tripUpdate;

      const data = await redis.get(latestId);

      if (!data) {
        continue;
      }
      const parsed = JSON.parse(data);

      parsed.stopTimeUpdate = stopTimeUpdate;

      await redis.set(latestId, JSON.stringify(parsed))

    }
  }

}