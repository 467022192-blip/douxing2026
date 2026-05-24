const fs = require('fs');
const https = require('https');

const filePath = 'src/data/mockAttractions.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const startIndex = content.indexOf('[');
const endIndex = content.lastIndexOf(']');
const arrayStr = content.substring(startIndex, endIndex + 1);
let attractions = eval(`(${arrayStr})`);

function getWikiImage(title) {
  return new Promise((resolve) => {
    // Some titles might need cleaning (e.g., "八达岭—慕田峪长城旅游区" -> "八达岭长城")
    let searchTitle = title;
    if (title.includes("八达岭")) searchTitle = "八达岭长城";
    if (title.includes("云冈石窟")) searchTitle = "云冈石窟";
    
    const url = `https://zh.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&pithumbsize=600&titles=${encodeURIComponent(searchTitle)}`;
    
    https.get(url, { headers: { 'User-Agent': 'TraeBot/1.0' }, timeout: 3000 }, (res) => {
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
    }).on('error', () => resolve(null))
      .on('timeout', () => resolve(null));
  });
}

// Fallback Unsplash categories with lowered resolution (w=400&q=60)
const unsplashFallbacks = {
  mountain: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&auto=format&fit=crop&q=60",
  lake: "https://images.unsplash.com/photo-1437482078695-73f5ca6c96e2?w=400&auto=format&fit=crop&q=60",
  temple: "https://images.unsplash.com/photo-1549405625-78e874cefb66?w=400&auto=format&fit=crop&q=60",
  oldTown: "https://images.unsplash.com/photo-1552604617-eea98aa27234?w=400&auto=format&fit=crop&q=60",
  museum: "https://images.unsplash.com/photo-1518998053401-a4149019da8e?w=400&auto=format&fit=crop&q=60",
  garden: "https://images.unsplash.com/photo-1507208316335-8b1d960965d4?w=400&auto=format&fit=crop&q=60",
  default1: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&auto=format&fit=crop&q=60",
  default2: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=400&auto=format&fit=crop&q=60"
};

function getFallback(name, index) {
  if (name.includes("山") || name.includes("峡谷") || name.includes("峰")) return unsplashFallbacks.mountain;
  if (name.includes("湖") || name.includes("水") || name.includes("瀑布")) return unsplashFallbacks.lake;
  if (name.includes("寺") || name.includes("塔") || name.includes("庙")) return unsplashFallbacks.temple;
  if (name.includes("古城") || name.includes("镇") || name.includes("老街")) return unsplashFallbacks.oldTown;
  if (name.includes("博物") || name.includes("纪念")) return unsplashFallbacks.museum;
  if (name.includes("公园") || name.includes("园")) return unsplashFallbacks.garden;
  return index % 2 === 0 ? unsplashFallbacks.default1 : unsplashFallbacks.default2;
}

async function processAll() {
  console.log(`Starting to process ${attractions.length} attractions...`);
  // We'll just fetch real images for the top 50 famous ones to save time, and fallback others
  // Actually let's try to fetch all, with a concurrency of 10
  let successCount = 0;
  
  for (let i = 0; i < attractions.length; i += 10) {
    const batch = attractions.slice(i, i + 10);
    const promises = batch.map(async (a, indexInBatch) => {
      const globalIndex = i + indexInBatch;
      let url = await getWikiImage(a.name);
      
      if (url) {
        a.image_url = url;
        successCount++;
      } else {
        // Lower resolution fallback
        a.image_url = getFallback(a.name, globalIndex);
      }
    });
    await Promise.all(promises);
    process.stdout.write(`\rProcessed ${Math.min(i + 10, attractions.length)}/${attractions.length} (Found ${successCount} real images)`);
  }
  
  console.log("\nDone fetching. Writing to file...");
  const updatedStr = JSON.stringify(attractions, null, 2);
  const newContent = content.substring(0, startIndex) + updatedStr + content.substring(endIndex + 1);
  fs.writeFileSync(filePath, newContent, 'utf-8');
  console.log("Mock data successfully updated with real images and compressed fallbacks!");
}

processAll();
