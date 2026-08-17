const https = require('https');
const urlModule = require('url');

function fetchPage(urlStr) {
  return new Promise((resolve, reject) => {
    const parsedUrl = urlModule.parse(urlStr);
    https.get({
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}${redirectUrl}`;
        }
        resolve(fetchPage(redirectUrl));
        return;
      }
      
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { resolve(data); });
    }).on('error', (err) => { reject(err); });
  });
}

async function searchProduct(query) {
  try {
    const url = 'https://dostupsreda.ru/search/?q=' + encodeURIComponent(query);
    console.log(`Searching dostupsreda.ru for: ${query}...`);
    const html = await fetchPage(url);
    
    // Look for /upload/iblock/ image paths
    const imgRegex = /upload\/iblock\/[a-f0-9]+\/[a-f0-9]+\.(?:jpg|png|gif|jpeg|webp)/gi;
    const matches = html.match(imgRegex) || [];
    const uniqueMatches = Array.from(new Set(matches)).map(p => 'https://dostupsreda.ru/' + p);
    
    console.log(`Results for '${query}':`, uniqueMatches.slice(0, 5));
    return uniqueMatches[0] || null;
  } catch (err) {
    console.error(`Error searching for ${query}:`, err.message);
    return null;
  }
}

async function main() {
  const queries = [
    "крючок для костылей",
    "мнемосхема санузла 300х400",
    "пиктограмма пвх 150х150",
    "пиктограмма пвх 150х200",
    "профиль с противоскользящей вставкой",
    "кнопка вызова помощи",
    "поручень для инвалидов откидной"
  ];
  
  for (const q of queries) {
    await searchProduct(q);
    await new Promise(r => setTimeout(r, 1000));
  }
}

main();
