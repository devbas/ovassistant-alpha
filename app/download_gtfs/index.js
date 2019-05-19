const request = require('request-promise')
const AWS = require('aws-sdk')
const s3 = new AWS.S3()

exports.handler = async (event, ctx) => {
  
  const options = {
    uri: 'http://gtfs.ovapi.nl/nl/gtfs-nl.zip',
    encoding: null
  };
    
  const body = await request(options)
  
  const uploadResult = await s3.upload({
    Bucket: process.env.gtfs_bucket,
    Key   : 'gtfs-nl.zip',
    Body  : body,   
  }).promise()
    
  return;
  
}
