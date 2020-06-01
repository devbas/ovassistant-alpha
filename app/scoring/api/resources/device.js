const express = require('express')
const Sentry = require('../../sentry.js')
const matchCalculationController = require('../../controllers/calculate')
const config = require('../../config/config')
const { Pool } = require('pg')

var router = express.Router()

const pgPool = new Pool(config.pg)

router.post('/score', async (req, res) => {
  console.log('retrieved request HALLO: ', req.header('X-Transaction-ID'))
  const data = req.body
  console.log('data: ', req.body)

  let parsedData = {}

  if(data.datetime) {
    parsedData.datetime = parseInt(data.datetime)
  }

  if(data.location && data.location.coords && data.location.coords.latitude) {
    parsedData.lat = parseFloat(data.location.coords.latitude)
  }

  if(data.location && data.location.coords && data.location.coords.longitude) {
    parsedData.lon = parseFloat(data.location.coords.longitude) 
  }

  if(data.userId) {
    parsedData.userId = data.userId
  }

  try {
    console.log('call the controller', data)
    const result = await matchCalculationController.getVehicleCandidates(parsedData, pgPool)
    console.log('sending result for: ', req.header('X-Transaction-ID'))
    res.status(200).json({ data: result })
  } catch(err) {
    console.log('err: ', err)
    res.status(500).send({ error: JSON.stringify(err) })
    Sentry.captureException(err)
  }
})

module.exports = router