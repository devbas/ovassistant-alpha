const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  const file = fs.readFileSync(path.join(__dirname, './index.html'), 'utf-8')
  return {
    statusCode: 200,
    body: file,
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  }

}