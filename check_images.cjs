const fs = require('fs');

const fileContent = fs.readFileSync('./src/data/mockAttractions.ts', 'utf8');

// Extract the MOCK_ATTRACTIONS array using a quick regex or eval (since it's a TS file, we can strip the 'export const ... =' part)
let arrayStr = fileContent.substring(fileContent.indexOf('['));
arrayStr = arrayStr.substring(0, arrayStr.lastIndexOf(']') + 1);

try {
  const attractions = eval(arrayStr);
  let realCount = 0;
  let fallbackCount = 0;
  
  attractions.forEach(a => {
    if (a.image_url && a.image_url.includes('wikimedia.org')) {
      realCount++;
    } else {
      fallbackCount++;
    }
  });
  
  console.log(`Total Attractions: ${attractions.length}`);
  console.log(`Real Images (Wikimedia): ${realCount} (${((realCount/attractions.length)*100).toFixed(2)}%)`);
  console.log(`Fallback Images (Unsplash): ${fallbackCount} (${((fallbackCount/attractions.length)*100).toFixed(2)}%)`);
} catch(e) {
  console.error("Parse error:", e.message);
}
