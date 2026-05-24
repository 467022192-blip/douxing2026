const fs = require('fs');

const fileContent = fs.readFileSync('./src/data/mockAttractions.ts', 'utf8');
let arrayStr = fileContent.substring(fileContent.indexOf('['));
arrayStr = arrayStr.substring(0, arrayStr.lastIndexOf(']') + 1);
let attractions = eval(arrayStr);

let md = '# 景区名称精简校对表\n\n| 原景区名称 | 精简后名称 |\n|---|---|\n';

let changedCount = 0;

attractions.forEach(a => {
  // Regex to strip generic tourism suffixes
  let short = a.name.replace(/(国际)?(生态)?(文化)?(旅游)?(度假区|风景区|名胜区|旅游区|景区|国家森林公园|森林公园|国家地质公园|地质公园|国家公园|自然保护区|主题公园|游乐园|休博园|世纪城|风景名胜区|旅游名胜区|风景旅游区)/g, '');
  
  // Strip parentheses and their contents
  short = short.replace(/(\\(|（).*?(\\)|）)/g, '');
  
  // Strip trailing "公园" if the name is long enough, but keep it for famous short ones like "天坛公园"
  if (short.endsWith('公园') && short.length > 4) {
    short = short.replace(/公园$/, '');
  }

  // Strip prefix matching city/province if it's too long
  // e.g., "北京市八达岭—慕田峪长城" -> "八达岭—慕田峪长城"
  const prefixRegex = new RegExp(`^(${a.province}|${a.city})`);
  short = short.replace(prefixRegex, '');
  
  // Clean up dashes
  short = short.replace(/^[—\\-·•]+|[—\\-·•]+$/g, '');

  short = short.trim();

  // Safety fallback: if we stripped too much (less than 2 characters), revert to original
  if (short.length < 2) {
    short = a.name;
  }

  if (short !== a.name) {
    md += `| ${a.name} | ${short} |\n`;
    changedCount++;
  }
  
  a.short_name = short;
});

const tsContent = `import type { Attraction } from '../types';\n\nexport const MOCK_ATTRACTIONS: Attraction[] = ${JSON.stringify(attractions, null, 2)};\n`;
fs.writeFileSync('./src/data/mockAttractions.ts', tsContent, 'utf8');
fs.writeFileSync('./attraction_names_mapping.md', md, 'utf8');

console.log(`Generated short names for all attractions. Simplified ${changedCount} names.`);
