const https = require('https');
const url = 'https://script.google.com/macros/s/AKfycbx0tzNBlYPgaks51yZk6hU3d5UU32LjXvybSJWXekup7HxgjcCk86gVrCy_9X12dQIbTQ/exec';

const data = JSON.stringify({
  __api: 1,
  fn: 'apiTizimHolatOl',
  args: []
});

const req = https.request(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'text/plain;charset=utf-8',
    'Content-Length': data.length
  }
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
