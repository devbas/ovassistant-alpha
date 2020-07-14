/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
* 
* Updates the trajectory timing for tripId by deducting the delta from the measurement timestamp onwards.
*
*/ 
const updateTrajectoryTiming = async ({ vehicleId, delaySeconds, measurementUnix, pgPool }) => {

  try {

    const client = await pgPool.connect()

    const { rows: trip } = await client.query(`SELECT trip_id FROM trips WHERE realtime_trip_id = ${vehicleId}`)

    if(trip[0].trip_id) {
      await client.query(`UPDATE trip_times_partitioned TTP1
                            SET 
                            TTP1.start_planned = TTP2.start_planned + TTP2.delay_seconds - ${delaySeconds}, 
                            TTP1.end_planned = TTP2.end_planned + TTP2.delay_seconds - ${delaySeconds}, 
                            TTP1.delay_seconds = ${delaySeconds}
                          FROM trip_times_partitioned TTP2
                          WHERE TTP1.triptime_id = TTP2.triptime_id
                          AND TTP2.trip_id = ${trip[0].trip_id}
                          AND TTP2.end_planned >= (${measurementUnix} + TTP2.delay_seconds - ${delaySeconds})
                          AND TTP2.end_planned <= (${measurementUnix} + 1000) // Target for tuning`)
    } else {
      console.log('no trip found for: ' + vehicleId)
    }

    /* 

    UPDATE trip_times_partitioned TTP1 
    SET 
      TTP1.start_planned = TTP2.start_planned + TTP2.delay_seconds - ${delta}, 
      TTP1.end_planned = TTP2.end_planned + TTP2.delay_seconds - ${delta}
    FROM trip_times_partitioned TTP2
    WHERE TTP1.triptime_id = TTP2.triptime_id
    AND TTP2.trip_id = ${trip_id}
    AND TTP2.end_planned >= (${measurementUnix} + TTP2.delay_seconds - ${delta})
    AND TTP2.end_planned <= (${measurementUnix} + 1000) // Target for tuning
    */

  } catch (err) {
    console.log({ err: err })
  } finally {
    client.release()
  }
}

module.exports = { updateTrajectoryTiming: updateTrajectoryTiming }