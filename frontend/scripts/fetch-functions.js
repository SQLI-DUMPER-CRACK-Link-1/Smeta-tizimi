import fs from 'fs';

const GAS_URL = process.env.GAS_URL;
const GAS_TOKEN = process.env.GAS_TOKEN;

if (!GAS_URL || !GAS_TOKEN) {
  console.error('GAS_URL va GAS_TOKEN muhit o\'zgaruvchilari kerak.');
  console.error('Masalan: GAS_TOKEN=xxx GAS_URL=yyy node scripts/fetch-functions.js');
  process.exit(1);
}

async function run() {
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        __api: 1,
        token: GAS_TOKEN,
        fn: 'apiWebApiFunksiyalar',
        args: []
      })
    });
    const text = await res.text();
    const data = JSON.parse(text);
    if (!data.ok) {
      console.error('Error fetching functions:', data.error);
      return;
    }
    fs.mkdirSync('./src/api', { recursive: true });
    fs.writeFileSync('./src/api/gas-functions.json', JSON.stringify(data.data, null, 2));
    console.log('Successfully saved to src/api/gas-functions.json');

    // Also test apiWebApiSalom
    const res2 = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          __api: 1,
          token: GAS_TOKEN,
          fn: 'apiWebApiSalom',
          args: []
        })
      });
      const data2 = JSON.parse(await res2.text());
      console.log('Salom:', data2);
  } catch (err) {
    console.error('Failed:', err);
  }
}

run();
