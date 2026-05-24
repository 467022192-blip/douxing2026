const fs = require('fs');

const fileContent = fs.readFileSync('./src/data/mockAttractions.ts', 'utf8');
let arrayStr = fileContent.substring(fileContent.indexOf('['));
arrayStr = arrayStr.substring(0, arrayStr.lastIndexOf(']') + 1);

let attractions = eval(arrayStr);
let revertedCount = 0;

const badExtensions = ['.djvu', '.pdf', '.svg', '.webm', '.ogg', '.ogv', '.mp4'];

attractions.forEach(a => {
  if (a.image_url) {
    // Check if the inner URL ends with a bad extension (it's encoded in wsrv.nl url)
    const lowerUrl = a.image_url.toLowerCase();
    const hasBadExt = badExtensions.some(ext => lowerUrl.includes(ext) || lowerUrl.includes(encodeURIComponent(ext)));
    
    if (hasBadExt) {
      console.log(`Reverting bad image for ${a.name}: ${a.image_url}`);
      a.image_url = 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=60&output=webp'; // Temporary fallback
      revertedCount++;
    }
  }
});

const tsContent = `import type { Attraction } from '../types';\n\nexport const MOCK_ATTRACTIONS: Attraction[] = ${JSON.stringify(attractions, null, 2)};\n`;
fs.writeFileSync('./src/data/mockAttractions.ts', tsContent, 'utf8');

console.log(`Reverted ${revertedCount} bad images.`);
