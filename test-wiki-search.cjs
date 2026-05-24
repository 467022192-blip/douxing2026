const https = require('https');

function searchWikiImage(query) {
  return new Promise((resolve) => {
    const url = `https://zh.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=pageimages&pithumbsize=800&format=json`;
    https.get(url, { headers: { 'User-Agent': 'TraeBot/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.query && json.query.pages) {
            const pages = json.query.pages;
            const pageId = Object.keys(pages)[0];
            if (pages[pageId].thumbnail) {
              resolve(pages[pageId].thumbnail.source);
              return;
            }
          }
          resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

searchWikiImage("大同市云冈石窟").then(console.log);
searchWikiImage("承德避暑山庄").then(console.log);
