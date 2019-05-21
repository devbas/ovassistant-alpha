
const mysql = require('mysql');
const fs = require('fs');
const util = require('util');

exports.handler = (event, ctx) => {

  var conn = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASSWORD,
    multipleStatements: true
  });

  const query = util.promisify(conn.query).bind(conn);
  const readFileAsync = util.promisify(fs.readFile)

  const script1 = await fs.readFileAsync('ovassistant.sql')
  const script2 = await fs.readFileAsync('z_import.sql')

  await query(`GRANT LOAD FROM S3 ON *.* TO ${process.env.MYSQL_USERNAME}@${process.env.MYSQL_HOST}`)

  await query(script1)
  await query(script2)

}