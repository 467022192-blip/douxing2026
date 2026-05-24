const fs = require('fs');
const https = require('https');

const filePath = 'src/data/mockAttractions.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const startIndex = content.indexOf('[');
const endIndex = content.lastIndexOf(']');
const arrayStr = content.substring(startIndex, endIndex + 1);
let attractions = eval(`(${arrayStr})`);

function searchWikiImage(query) {
  return new Promise((resolve) => {
    let cleanQuery = query.replace(/风景名胜区|旅游区|景区|风景区|国家森林公园/, '');
    const url = `https://zh.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanQuery)}&gsrlimit=1&prop=pageimages&pithumbsize=800&format=json`;
    
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }, (res) => {
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
    }).on('error', () => resolve(null)).on('timeout', () => resolve(null));
  });
}

const wait = ms => new Promise(res => setTimeout(res, ms));

async function processAll() {
  console.log(`Fetching slowly to bypass rate limits...`);
  let successCount = 0;
  
  for (let i = 0; i < attractions.length; i += 3) {
    const batch = attractions.slice(i, i + 3);
    const promises = batch.map(async (a) => {
      if (a.image_url && a.image_url.includes('wikimedia.org')) {
         successCount++;
         return;
      }
      
      let url = await searchWikiImage(a.name);
      if (url) {
        a.image_url = `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=600&q=70&output=webp`;
        successCount++;
      }
    });
    
    await Promise.all(promises);
    await wait(300); // Wait 300ms between batches
    process.stdout.write(`\rProcessed ${Math.min(i + 3, attractions.length)}/${attractions.length} (Found ${successCount} real images)`);
  }
  
  console.log("\nWriting to file...");
  const updatedStr = JSON.stringify(attractions, null, 2);
  const newContent = content.substring(0, startIndex) + updatedStr + content.substring(endIndex + 1);
  fs.writeFileSync(filePath, newContent, 'utf-8');
  console.log("Mock data successfully updated!");
}

processAll();
