const https = require('https');

function fetchHtml(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html'
      },
      timeout: 5000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http') ? res.headers.location : `https://baike.baidu.com${res.headers.location}`;
        resolve(fetchHtml(redirectUrl));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', () => resolve(null)).on('timeout', () => resolve(null));
  });
}

(async () => {
  const html = await fetchHtml("https://baike.baidu.com/item/" + encodeURIComponent("九寨沟"));
  const match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) || 
                html.match(/<img\s+class="picture"\s+src="([^"]+)"/i) ||
                html.match(/src="([^"]+)"\s+class="[^"]*summary-pic/i);
  console.log("九寨沟 image:", match ? match[1] : null);
})();
