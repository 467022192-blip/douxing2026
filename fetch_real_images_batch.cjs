const fs = require('fs');
const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'TraeBot/1.0 (https://trae.ai)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

function cleanAttractionName(name) {
  let cleaned = name;
  const stops = [
    "风景名胜区", "风景区", "旅游区", "景区", "国家森林公园", "森林公园", 
    "地质公园", "国家地质公园", "国家级", "生态旅游区", "度假区", "旅游度假区",
    "历史文化名城", "古城", "文化旅游区", "主题公园", "名胜区", "自然保护区"
  ];
  
  for (const stop of stops) {
    cleaned = cleaned.replace(new RegExp(stop, 'g'), '');
  }

  // Remove province/city prefixes if they are just prefixes, but for simple search it's often better to just strip them
  cleaned = cleaned.replace(/.*省|.*自治区|.*市(?!.*市)|.*自治州|.*地区|.*县/g, match => {
    // If the whole string is matched, don't replace
    if (match.length === cleaned.length) return match;
    return '';
  });

  // e.g. "大同市云冈石窟" -> "云冈石窟"
  // "阿坝藏族羌族自治州九寨沟" -> "九寨沟"
  
  return cleaned.trim() || name;
}

async function searchWikimedia(keyword) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(keyword)}&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url&format=json`;
  const data = await fetchJson(url);
  if (data && data.query && data.query.pages) {
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    if (pageId && pages[pageId].imageinfo && pages[pageId].imageinfo.length > 0) {
      return pages[pageId].imageinfo[0].url;
    }
  }
  return null;
}

async function searchWikipediaZh(keyword) {
  const url = `https://zh.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(keyword)}&prop=pageimages&pithumbsize=800&format=json`;
  const data = await fetchJson(url);
  if (data && data.query && data.query.pages) {
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    if (pageId && pageId !== "-1" && pages[pageId].thumbnail) {
      return pages[pageId].thumbnail.source;
    }
  }
  return null;
}

async function searchWikipediaEn(keyword) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(keyword)}&prop=pageimages&pithumbsize=800&format=json`;
  const data = await fetchJson(url);
  if (data && data.query && data.query.pages) {
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    if (pageId && pageId !== "-1" && pages[pageId].thumbnail) {
      return pages[pageId].thumbnail.source;
    }
  }
  return null;
}

(async () => {
  const fileContent = fs.readFileSync('./src/data/mockAttractions.ts', 'utf8');
  let arrayStr = fileContent.substring(fileContent.indexOf('['));
  arrayStr = arrayStr.substring(0, arrayStr.lastIndexOf(']') + 1);
  
  let attractions = eval(arrayStr);
  let updatedCount = 0;

  console.log(`Starting image fetch for ${attractions.length} attractions...`);

  // We'll process them in batches to be fast but not hit rate limits too hard
  const batchSize = 10;
  for (let i = 0; i < attractions.length; i += batchSize) {
    const batch = attractions.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (attraction) => {
      if (attraction.image_url && attraction.image_url.includes('wikimedia.org')) {
        return; // Already has a real image
      }

      const cleanedName = cleanAttractionName(attraction.name);
      const searchTerms = [
        cleanedName,
        attraction.name,
        cleanedName.substring(0, 4) // Fallback to short name
      ];

      let foundUrl = null;

      for (const term of searchTerms) {
        if (!term) continue;
        
        foundUrl = await searchWikimedia(term);
        if (foundUrl) break;
        
        foundUrl = await searchWikipediaZh(term);
        if (foundUrl) break;
      }

      if (foundUrl) {
        // Use wsrv.nl to proxy and format
        attraction.image_url = `https://wsrv.nl/?url=${encodeURIComponent(foundUrl)}&w=600&q=70&output=webp`;
        updatedCount++;
        console.log(`[OK] ${attraction.name} -> ${foundUrl}`);
      } else {
        console.log(`[MISS] ${attraction.name} (searched: ${cleanedName})`);
      }
    }));
    
    // Save progress periodically
    const tsContent = `import type { Attraction } from '../types';\n\nexport const MOCK_ATTRACTIONS: Attraction[] = ${JSON.stringify(attractions, null, 2)};\n`;
    fs.writeFileSync('./src/data/mockAttractions.ts', tsContent, 'utf8');
    
    console.log(`Processed ${Math.min(i + batchSize, attractions.length)} / ${attractions.length} (Updated: ${updatedCount})`);
  }

  console.log(`Done! Fetched real images for ${updatedCount} attractions.`);
})();
