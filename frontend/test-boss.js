async function test() {
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbxhZgAn59VJOiwcUxqw4MhrlNMOCHd4AJDnEtzwJ7DL/exec';
  const r = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ __api: 1, token: 'test', fn: 'apiBossData', args: [] }),
    redirect: 'follow'
  });
  const data = await r.json();
  console.log('Result:', JSON.stringify(data, null, 2).slice(0, 1000));
}
test();
