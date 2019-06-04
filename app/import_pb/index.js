const request = require('request-promise-native');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const redis = require('./redis');
const LatLon = require('./movable');
const AWS = require('aws-sdk')
const s3 = new AWS.S3()

const isPersist = process.env.INGESTION_PERSIST || true;

exports.handler = async (event) => {
  const params = {
    Bucket: event['Records'][0]['s3']['bucket']['name'],
    Key: event['Records'][0]['s3']['object']['key']
  }

  const data = s3.getObject(params).promise();

  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(data);
  
  for (const entityId in feed.entity) {
    if (!feed.entity.hasOwnProperty(entityId)) continue;

    const entity = feed.entity[entityId];
    console.log('entity', JSON.stringify(entity,null,2))
    const {
      vehicle,
      alert,
      tripUpdate,
      trainUpdate
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

      const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);

      const latestId = `${entity.id}:latest`;

      const row = {
        id: entity.id,
        datetimeUnix: date,
        latitude: latitude,
        longitude: longitude 
      }

      const vehiclePrevRaw = await redis.get(latestId)

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
      }
  
      if (isPersist) {
        await redis.set(latestId, JSON.stringify(row))
        await redis.geoadd('items', row.longitude, row.latitude, latestId)
      } else {
        await redis.set(latestId, JSON.stringify(row), 'EX', 40)
        await redis.geoadd('items', row.longitude, row.latitude, latestId)
      }
    }

    if (alert) {

    }

    if (tripUpdate) {
      console.log('tripUpdate', tripUpdate)

    }

    if (trainUpdate) {
      console.log('trainUpdate', trainUpdate)
    }
  }

}