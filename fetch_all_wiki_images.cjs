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
    // Strip some suffixes to improve search accuracy
    let cleanQuery = query.replace(/风景名胜区|旅游区|景区|风景区/, '');
    
    const url = `https://zh.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanQuery)}&gsrlimit=1&prop=pageimages&pithumbsize=800&format=json`;
    https.get(url, { headers: { 'User-Agent': 'TraeBot/1.0' }, timeout: 4000 }, (res) => {
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

async function processAll() {
  console.log(`Starting to fetch real images for ${attractions.length} attractions via Wikipedia Search API...`);
  let successCount = 0;
  
  for (let i = 0; i < attractions.length; i += 10) {
    const batch = attractions.slice(i, i + 10);
    const promises = batch.map(async (a) => {
      // If it's already a wikimedia image from the previous run, we can keep it
      if (a.image_url && a.image_url.includes('wikimedia.org') && !a.image_url.includes('wsrv.nl')) {
         a.image_url = `https://wsrv.nl/?url=${encodeURIComponent(a.image_url)}&w=600&q=70&output=webp`;
         successCount++;
         return;
      }
      
      let url = await searchWikiImage(a.name);
      if (url) {
        // Proxy through wsrv.nl to bypass GFW and compress
        a.image_url = `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=600&q=70&output=webp`;
        successCount++;
      } else {
        // Ensure unsplash images are also proxied/compressed to prevent load failure
        if (a.image_url && a.image_url.includes('unsplash.com')) {
          let cleanUnsplash = a.image_url.split('?')[0]; // remove query params
          a.image_url = `https://wsrv.nl/?url=${encodeURIComponent(cleanUnsplash)}&w=400&q=60&output=webp`;
        }
      }
    });
    
    await Promise.all(promises);
    process.stdout.write(`\rProcessed ${Math.min(i + 10, attractions.length)}/${attractions.length} (Found/Processed ${successCount} real images)`);
  }
  
  console.log("\nDone fetching. Writing to file...");
  const updatedStr = JSON.stringify(attractions, null, 2);
  const newContent = content.substring(0, startIndex) + updatedStr + content.substring(endIndex + 1);
  fs.writeFileSync(filePath, newContent, 'utf-8');
  console.log("Mock data successfully updated with proxied and compressed images!");
}

processAll();
