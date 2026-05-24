const fs = require('fs');

const fileContent = fs.readFileSync('./src/data/mockAttractions.ts', 'utf8');
let arrayStr = fileContent.substring(fileContent.indexOf('['));
arrayStr = arrayStr.substring(0, arrayStr.lastIndexOf(']') + 1);

let attractions = eval(arrayStr);

// Curated Unsplash IDs by category
const imagePools = {
  mountain: [
    '1464822759023-fed622ff2c3b', '1454496564346-bf52dce4faa4', '1520209268518-ca47f4be7758',
    '1534065406085-307590a36413', '1480498073050-4d8e573e86da', '1506198906323-01048b3260c7',
    '1544732103-68d18eb85848', '1433086966358-54859d0ed716'
  ],
  water: [
    '1437482078695-73f5ca6c96e2', '1476514525535-07fb3b4ae5f1', '1493246507139-91e8fad9978e',
    '1507525428034-b723cf961d3e', '1518182170546-076616fd6779', '1445307390731-0bb6a8d67272',
    '1461696114087-397271a7aedc', '1473448912268-2022ce9509d8'
  ],
  historical: [
    '1552604617-eea98aa27234', '1548345680-f5475ea90f84', '1513686256910-f1c713b1456a',
    '1508804052814-cd32f7e0b404', '1584646098378-0874589d79b1', '1560930950511-54c7d0d021c1',
    '1573210344437-01edfc8fbfab', '1540321285-d85c8e390c5c'
  ],
  temple: [
    '1555881400-74d7acaacd8b', '1538334460565-38db1ff110f0', '1564619420-56d11631ea3a',
    '1611082538183-b77265a7d300', '1560930950511-54c7d0d021c1', '1576483584860-dfa0b38b13be'
  ],
  nature: [
    '1441974231531-c6227db76b6e', '1426604908151-3a1153315430', '1465146344425-f00d5f5c8f07',
    '1501854140801-50d01698950b', '1447069387593-a5de0862481e', '1442850473887-0fb77cd0b337'
  ]
};

function getHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getCategory(name, features) {
  const str = (name + (features || '')).toLowerCase();
  if (str.includes('寺') || str.includes('庙') || str.includes('塔') || str.includes('窟') || str.includes('大佛')) return 'temple';
  if (str.includes('古城') || str.includes('古镇') || str.includes('遗址') || str.includes('故里') || str.includes('历史') || str.includes('城墙')) return 'historical';
  if (str.includes('山') || str.includes('峰') || str.includes('岭') || str.includes('岩') || str.includes('峡')) return 'mountain';
  if (str.includes('湖') || str.includes('海') || str.includes('湾') || str.includes('池') || str.includes('江') || str.includes('河') || str.includes('瀑') || str.includes('岛') || str.includes('泉')) return 'water';
  return 'nature';
}

let updatedCount = 0;

attractions.forEach(a => {
  if (a.image_url && a.image_url.includes('unsplash.com')) {
    const category = getCategory(a.name, a.features);
    const pool = imagePools[category];
    const index = getHash(a.id + a.name) % pool.length;
    const unsplashId = pool[index];
    
    a.image_url = `https://images.unsplash.com/photo-${unsplashId}?w=800&auto=format&fit=crop&q=60`;
    updatedCount++;
  }
});

const tsContent = `import type { Attraction } from '../types';\n\nexport const MOCK_ATTRACTIONS: Attraction[] = ${JSON.stringify(attractions, null, 2)};\n`;
fs.writeFileSync('./src/data/mockAttractions.ts', tsContent, 'utf8');

console.log(`Assigned personalized fallback images to ${updatedCount} attractions.`);
