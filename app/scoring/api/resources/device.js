const express = require('express')
const Sentry = require('../../sentry.js')
const viterbi = require('../../viterbi')

var router = express.Router()

router.post('/score', async (req, res) => {
  const data = req.body

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
    const result = await viterbi.score(parsedData.lon, parsedData.lat, parsedData.datetime, parsedData.userId)
    res.status(200).json({ data: result })
  } catch(err) {
    console.log('err: ', err)
    res.status(500).send({ error: JSON.stringify(err) })
    Sentry.captureException(err)
  }
})

module.exports = router