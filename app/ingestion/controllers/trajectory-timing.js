/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
* 
* Updates the trajectory timing for tripId by deducting the delta from the measurement timestamp onwards.
*
*/ 
const updateTrajectoryTiming = async ({ vehicleId, delaySeconds, measurementUnix, pgPool, vehicleType, operatingDay }) => {

  const client = await pgPool.connect()

  try {

    let trip = false

    if(vehicleType === 'train') {
      const rows = await client.query(`SELECT trip_id FROM trips T JOIN calendar_dates CD ON T.service_id = CD.service_id WHERE T.trip_short_name = $1 AND CD.date = $2 LIMIT 1`, [vehicleId, operatingDay.split('-').join('')])
      trip = rows
    } 

    if(vehicleType === 'vehicle') {
      const rows = await client.query(`SELECT trip_id FROM trips T JOIN calendar_dates CD ON T.service_id = CD.service_id WHERE T.realtime_trip_id = $1 AND CD.date = $2 LIMIT 1`, [vehicleId, operatingDay.split('-').join('')])
      trip = rows
    }

    if(trip[0] && trip[0].trip_id) {
      const result = await client.query(`UPDATE trip_times_partitioned
                            SET 
                            start_planned = start_planned + delay_seconds - $1, 
                            end_planned = end_planned + delay_seconds - $2, 
                            delay_seconds = $3
                          WHERE trip_id = $4
                          AND end_planned >= ($5 + delay_seconds - $6)
                          AND end_planned <= ($7 + 1000)`, [delaySeconds, delaySeconds, delaySeconds, trip[0].trip_id, measurementUnix, delaySeconds, measurementUnix])

      console.log(`updated ${result.rowCount} rows for tripId: ${trip[0].trip_id}, vehicleId ${vehicleId} with ${delaySeconds} for ${measurementUnix}`)
    } else {
      console.log('nothing for trip: ', trip)
    }

  } catch (err) {
    console.log({ trajectoryTimingError: err })
  } finally {
    client.release()
  }
}

module.exports = { updateTrajectoryTiming: updateTrajectoryTiming }