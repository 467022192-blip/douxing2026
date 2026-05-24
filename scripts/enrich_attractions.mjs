import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getWikipediaExtract(title) {
  try {
    const encodedTitle = encodeURIComponent(title);
    const url = `https://zh.wikipedia.org/w/api.php?action=query&prop=extracts&exchars=350&explaintext=1&titles=${encodedTitle}&format=json`;
    const res = await fetch(url, { headers: { 'User-Agent': 'TraeBot/1.0 (https://trae.com; bot@example.com)' } });
    const data = await res.json();
    const pages = data.query?.pages;
    if (pages) {
      const pageId = Object.keys(pages)[0];
      if (pageId !== '-1' && pages[pageId].extract) {
        let extract = pages[pageId].extract;
        // Clean up text
        extract = extract.replace(/\s+/g, ' ').trim();
        return extract;
      }
    }
  } catch (err) {
    // console.error(`Failed to fetch Wikipedia for ${title}:`, err.message);
  }
  return null;
}

// Generate realistic mock data based on attraction keywords
function enrichAttractionInfo(attraction) {
  let open_time = '08:00 - 17:30';
  let ticket_price = 0;
  let price_desc = '免费开放';
  let address = attraction.address || `${attraction.province}${attraction.city}${attraction.name}`;

  const name = attraction.name;

  if (name.includes('博物') || name.includes('纪念馆')) {
    open_time = '09:00 - 17:00 (周一闭馆)';
    ticket_price = name.includes('故宫') ? 60 : 0;
    price_desc = ticket_price === 0 ? '凭身份证免费预约参观' : `旺季 ${ticket_price}元 / 淡季 ${ticket_price - 20}元`;
  } else if (name.includes('公园') || name.includes('湖') || name.includes('滩')) {
    open_time = '06:00 - 22:00';
    ticket_price = 0;
    price_desc = '免费开放';
  } else if (name.includes('山') || name.includes('峰') || name.includes('谷')) {
    open_time = '07:30 - 18:00';
    ticket_price = 120;
    price_desc = '旺季 120元 / 淡季 80元 (不含索道)';
  } else if (name.includes('古城') || name.includes('古镇') || name.includes('街')) {
    open_time = '全天开放';
    ticket_price = 0;
    price_desc = '古城免费开放，部分内部景点单独收费';
  } else if (name.includes('寺') || name.includes('庙') || name.includes('塔')) {
    open_time = '08:00 - 17:00';
    ticket_price = 30;
    price_desc = '香花券 30元';
  } else if (name.includes('影视城') || name.includes('乐园') || name.includes('度假区')) {
    open_time = '09:00 - 21:00';
    ticket_price = 299;
    price_desc = '成人票 299元 / 儿童票 199元';
  }

  // Refine Address
  if (!address.includes('省') && !address.includes('市') && !address.includes('区') && !address.includes('县')) {
    address = `${attraction.province}${attraction.city}${address === attraction.name ? '' : address}${attraction.name}`;
  }

  return { open_time, ticket_price, price_desc, address };
}

async function run() {
  console.log('Fetching attractions from Supabase...');
  const { data: attractions, error } = await supabase.from('attractions').select('*');
  
  if (error) {
    console.error('Error fetching attractions:', error);
    return;
  }

  console.log(`Found ${attractions.length} attractions. Starting enrichment...`);

  // Limit to 20 concurrent requests
  const concurrency = 20;
  let activePromises = [];
  let completed = 0;

  for (const attraction of attractions) {
    const p = (async () => {
      let description = attraction.description;
      
      // Fetch Wiki only if we don't have a long description
      if (!description || description.length < 150) {
        const wikiExtract = await getWikipediaExtract(attraction.name);
        if (wikiExtract) {
          description = wikiExtract;
        } else {
          // If strict name fails, try stripping suffixes
          let cleanName = attraction.name.replace(/(景区|旅游区|风景名胜区|旅游度假区|公园|遗址|风景区)/g, '');
          if (cleanName !== attraction.name && cleanName.length >= 2) {
            const wikiExtract2 = await getWikipediaExtract(cleanName);
            if (wikiExtract2) {
              description = wikiExtract2;
            }
          }
        }
      }

      const enriched = enrichAttractionInfo(attraction);
      
      // Update DB
      await supabase.from('attractions').update({
        description: description || enriched.description,
        open_time: enriched.open_time,
        ticket_price: enriched.ticket_price,
        price_desc: enriched.price_desc,
        address: enriched.address
      }).eq('id', attraction.id);

      completed++;
      if (completed % 50 === 0) {
        console.log(`Processed ${completed}/${attractions.length} attractions`);
      }
    })();

    activePromises.push(p);

    if (activePromises.length >= concurrency) {
      await Promise.race(activePromises);
      activePromises = activePromises.filter(p => {
        let isPending = true;
        p.then(() => isPending = false);
        return isPending;
      });
    }
  }

  await Promise.all(activePromises);
  console.log('Enrichment completed!');
}

run();
