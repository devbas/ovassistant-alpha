module.exports = {
  "mysql": {
    "connectionLimit": 80,
    "host": process.env.MYSQL_HOST, 
    "port": 3306, 
    "user": process.env.MYSQL_USER, 
    "password": process.env.MYSQL_PASSWORD, 
    "database": process.env.MYSQL_DATABASE
  }
}