const https = require('https');

function getWikiImage(title) {
  return new Promise((resolve) => {
    const url = `https://zh.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&pithumbsize=600&titles=${encodeURIComponent(title)}`;
    https.get(url, { headers: { 'User-Agent': 'TraeBot/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pages = json.query.pages;
          const pageId = Object.keys(pages)[0];
          if (pageId !== '-1' && pages[pageId].thumbnail) {
            resolve(pages[pageId].thumbnail.source);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

getWikiImage("故宫博物院").then(console.log);
