const fetch = require('node-fetch');

async function test() {
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbxhZgAn59VJOiwcUxqw4MhrlNMOCHd4AJDnEtzwJ7DL/dev'; // Test URL from 01_API_SHARTNOMA.md
  
  const r = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ __api: 1, token: "test", fn: "apiWebApiSalom", args: [] }),
    redirect: 'follow'
  });

  const text = await r.text();
  console.log("Status:", r.status);
  console.log("Response text:", text.slice(0, 500));
}

test();
