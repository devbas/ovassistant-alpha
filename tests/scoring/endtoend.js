const zmq            = require('zeromq');
const sock           = zmq.socket('sub');
const sock1          = zmq.socket('sub');
const zlib           = require('zlib')
const _              = require('lodash');     
const utils          = require('./utils');
const { promisify }  = require('util');

const parseString = require('xml2js').parseString;
const stripPrefix = require('xml2js').processors.stripPrefix;

const zlibWrapper = {
  unzip: promisify(zlib.unzip).bind(zlib) 
}
 
sock.connect('tcp://pubsub.besteffort.ndovloket.nl:7664');
sock.subscribe('/');

sock.on('message', async (topic, message) => {
  try {
    const buffer = await zlibWrapper.unzip(message)
    const data = buffer.toString('utf8')
    
    parseString(data, { tagNameProcessors: [ stripPrefix ]}, (err, result) => {

      if(_.has(result, 'ArrayOfTreinLocation')) {
        result = _.get(result, 'ArrayOfTreinLocation.TreinLocation')
        result.forEach((train) => {
          const id = 'train:' + _.get(train, 'TreinNummer.0')
          const latitude = Number(_.get(train, 'TreinMaterieelDelen.0.Latitude.0'))
          const longitude = Number(_.get(train, 'TreinMaterieelDelen.0.Longitude.0'))
          if (latitude && longitude) { 
            console.log({ longitude: longitude, latitude: latitude })
          }
        })
      } else if(_.has(result, 'PutReisInformatieBoodschapIn.ReisInformatieProductDVS.0.DynamischeVertrekStaat.0')) {
        result = _.get(result, 'PutReisInformatieBoodschapIn.ReisInformatieProductDVS.0.DynamischeVertrekStaat.0')
        let id = _.get(result, 'RitId.0')
        
        result.delay_seconds = 0 
        if (_.has(result, 'Trein.0.ExacteVertrekVertraging.0') && _.get(result, 'Trein.0.ExacteVertrekVertraging') !== 'PT0S') {
          result.has_delay = true;
          result.delay_seconds = utils.durationToSeconds(_.get(result, 'Trein.0.ExacteVertrekVertraging.0'))
        }

        if(id) {
          id = 'train:' + id; 
          // Post to /scoring
        }
      }
    })
  } catch(err) {
    console.log({ err: err })
  }
}); 

sock1.connect('tcp://pubsub.besteffort.ndovloket.nl:7658');
sock1.subscribe('/');

sock1.on('message', async (topic, message) => {
  try {
    const buffer = await zlibWrapper.unzip(message)
    const data = buffer.toString('utf8')

    parseString(data, { tagNameProcessors: [ stripPrefix ] }, (err, result) => {
      if(err) {
        throw(err)
      }

      if (_.get(result, 'VV_TM_PUSH.DossierName.0') === 'KV6posinfo') {
        const positions = _.get(result, 'VV_TM_PUSH.KV6posinfo');

        _.forEach(positions, (messages) => {
          
          _.forEach(_.keys(messages), (positionType) => {
            
            const positionMessages = messages[positionType]
            _.forEach(positionMessages, (positionMessage, i) => {
              const id = `vehicle:${positionMessage.dataownercode[0]}:${positionMessage.lineplanningnumber[0]}:${positionMessage.journeynumber[0]}`
              // console.log('vehicle: ', positionMessage)
              if (positionType === 'END') {
              } else {
                // console.log('positionMessage: ', positionMessage)
                const nowUnix = Math.round((new Date()).getTime() / 1000)

                const data = {
                  id: id, 
                  type: 'vehicle', 
                  agencyCode: positionMessage.dataownercode[0], 
                  datetimeUnix: nowUnix, 
                  measurementTimestamp: positionMessage.timestamp[0], 
                  operatingDay: positionMessage.operatingday[0]
                }

                if (positionMessage['rd-x'] && positionMessage['rd-x'][0] != -1 && positionMessage['rd-y'][0] != -1) {
                  data.latitude = utils.RD2lat(positionMessage['rd-x'][0], positionMessage['rd-y'][0]);
                  data.longitude = utils.RD2lng(positionMessage['rd-x'][0], positionMessage['rd-y'][0]);

                  if (data.longitude < -180 || data.longitude > 180) {
                    delete data.longitude
                  }

                  if (data.latitude < -85 || data.latitude > 85) {
                    delete data.latitude
                  }
                }

                if (positionMessage.punctuality) {
                  data.delay_seconds = parseInt(positionMessage.punctuality[0])
          
                  if (data.delay_seconds !== 0) {
                    data.has_delay = true
                  } 
                }

                if(data.latitude && data.longitude) {
                  console.log({ longitude: data.longitude, latitude: data.latitude })
                }

              }
            })

          })

        })
      } 
    })
  } catch(err) {
    console.log({ err: err })
  }
})