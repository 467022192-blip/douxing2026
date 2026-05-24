import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getWikipediaExtractBySearch(queryStr) {
  try {
    // 1. Search for the best matching page title
    const searchUrl = `https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(queryStr)}&utf8=&format=json`;
    const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'TraeBot/1.0 (https://trae.com; bot@example.com)' } });
    const searchData = await searchRes.json();
    
    if (!searchData.query || !searchData.query.search || searchData.query.search.length === 0) {
      return null;
    }
    
    const bestTitle = searchData.query.search[0].title;
    
    // 2. Fetch the extract for that title
    const extractUrl = `https://zh.wikipedia.org/w/api.php?action=query&prop=extracts&exchars=350&explaintext=1&redirects=1&titles=${encodeURIComponent(bestTitle)}&format=json`;
    const extractRes = await fetch(extractUrl, { headers: { 'User-Agent': 'TraeBot/1.0 (https://trae.com; bot@example.com)' } });
    const extractData = await extractRes.json();
    
    const pages = extractData.query?.pages;
    if (pages) {
      const pageId = Object.keys(pages)[0];
      if (pageId !== '-1' && pages[pageId].extract) {
        let extract = pages[pageId].extract;
        extract = extract.replace(/\s+/g, ' ').trim();
        return extract;
      }
    }
  } catch (err) {
    // ignore
  }
  return null;
}

function cleanAttractionName(name) {
  // Remove generic administrative and tourism words to improve search hit rate
  let cleaned = name.replace(/旅游度假区|风景名胜区|旅游景区|风景区|旅游区|景区|国家级|世界地质公园|公园|遗址|市|省|自治区/g, '');
  cleaned = cleaned.replace(/（.*?）|\(.*?\)/g, ''); // remove brackets
  if (cleaned.length < 2) return name; // fallback
  return cleaned.trim();
}

async function run() {
  const { data: attractions, error } = await supabase.from('attractions').select('id, name, tips');
  if (error) {
    console.error('Error:', error);
    return;
  }

  // Find attractions that still have short tips
  const toUpdate = attractions.filter(a => !a.tips || a.tips.length < 100);
  console.log(`Found ${toUpdate.length} attractions needing better descriptions out of ${attractions.length}`);

  let updated = 0;
  for (let i = 0; i < toUpdate.length; i++) {
    const attr = toUpdate[i];
    const cleanName = cleanAttractionName(attr.name);
    
    let extract = await getWikipediaExtractBySearch(cleanName);
    
    // If still nothing, try the original name
    if (!extract || extract.length < 50) {
      extract = await getWikipediaExtractBySearch(attr.name);
    }
    
    if (extract && extract.length > 50) {
      await supabase.from('attractions').update({ tips: extract }).eq('id', attr.id);
      updated++;
      console.log(`[${i+1}/${toUpdate.length}] Success: ${attr.name} -> ${extract.substring(0, 30)}...`);
    } else {
      console.log(`[${i+1}/${toUpdate.length}] Failed to find good description for: ${attr.name} (searched: ${cleanName})`);
    }
    
    await sleep(200); // polite rate limiting
  }
  
  console.log(`Done! Successfully updated ${updated} attractions with rich descriptions.`);
}

run();