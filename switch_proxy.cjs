const fs = require('fs');

const fileContent = fs.readFileSync('./src/data/mockAttractions.ts', 'utf8');
let arrayStr = fileContent.substring(fileContent.indexOf('['));
arrayStr = arrayStr.substring(0, arrayStr.lastIndexOf(']') + 1);

let attractions = eval(arrayStr);
let updatedCount = 0;

attractions.forEach(a => {
  if (a.image_url && a.image_url.includes('wsrv.nl')) {
    try {
      // Extract the encoded url from ?url=...&
      const match = a.image_url.match(/url=([^&]+)/);
      if (match) {
        const decodedUrl = decodeURIComponent(match[1]);
        const withoutProtocol = decodedUrl.replace(/^https?:\/\//, '');
        a.image_url = `https://i0.wp.com/${withoutProtocol}?w=1200&quality=85&strip=all`;
        updatedCount++;
      }
    } catch (e) {
      console.error('Failed to parse', a.image_url, e);
    }
  }
});

const tsContent = `import type { Attraction } from '../types';\n\nexport const MOCK_ATTRACTIONS: Attraction[] = ${JSON.stringify(attractions, null, 2)};\n`;
fs.writeFileSync('./src/data/mockAttractions.ts', tsContent, 'utf8');

console.log(`Replaced wsrv.nl with i0.wp.com for ${updatedCount} real images.`);
