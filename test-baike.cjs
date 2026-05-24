const https = require('https');

function fetchBaikeImage(title) {
  return new Promise((resolve) => {
    const url = `https://baike.baidu.com/item/${encodeURIComponent(title)}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Regex to find the summary image
        const match = data.match(/<img[^>]+src="(https:\/\/bkimg\.cdn\.bcebos\.com\/pic\/[^"]+)"/);
        if (match && match[1]) {
          resolve(match[1]);
        } else {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

fetchBaikeImage("瘦西湖").then(console.log);
fetchBaikeImage("五台山").then(console.log);
