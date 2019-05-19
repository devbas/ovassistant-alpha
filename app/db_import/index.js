
const mysql = require('mysql');

// Main handler function
exports.handler = (event, ctx, callback) => {

  var con = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASSWORD
  });

  con.connect(function(err) {
    if (err) return callback(err)
    console.log("Connected!");
    con.query("CREATE DATABASE IF NOT EXISTS test", function (err, result) {
      if (err) return callback(err)
      console.log("Database created");
      callback('done')
    });
  });

}