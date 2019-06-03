const request = require('request-promise-native');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const redis = require('./redis');
const LatLon = require('./movable')
const urls = {
//    verhiclePostions: 'http://gtfs.ovapi.nl/nl/vehiclePositions.pb',
//    alerts: 'http://gtfs.ovapi.nl/nl/alerts.pb',
//    tripUpdates: 'http://gtfs.ovapi.nl/nl/tripUpdates.pb',
    trainUpdates: 'http://gtfs.ovapi.nl/nl/trainUpdates.pb'
}

const isPersist = process.env.INGESTION_PERSIST || true;


exports.handler = async () => {

  for (const urlKey in urls) {
    if (!urls.hasOwnProperty(urlKey)) continue;

    const url = urls[urlKey];

    const requestSettings = {
      method: 'GET',
      url: url,
      encoding: null
    };

    const response = await request(requestSettings)
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(response);
    
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
            redis.set(prevIdentifier, JSON.stringify(vehiclePrev))
          } else { 
            redis.set(prevIdentifier, JSON.stringify(vehiclePrev), 'EX', 40)
          }
    
          if (vehiclePointPrev[0]) {
    
            if (isPersist) {
              redis.geoadd('items', vehiclePointPrev[0][0], vehiclePointPrev[0][1], prevIdentifier)
            } else {
              redis.geoadd('items', vehiclePointPrev[0][0], vehiclePointPrev[0][1], prevIdentifier)
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
          redis.set(latestId, JSON.stringify(row))
          redis.geoadd('items', row.longitude, row.latitude, latestId)
        } else {
          redis.set(latestId, JSON.stringify(row), 'EX', 40)
          redis.geoadd('items', row.longitude, row.latitude, latestId)
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

    break;

  }

}