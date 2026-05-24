import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 读取原始的 MOCK_ATTRACTIONS 以获取简短描述
const mockDataContent = fs.readFileSync('./src/data/mockAttractions.ts', 'utf-8');
// 提取 JSON 数组部分
const jsonMatch = mockDataContent.match(/export const MOCK_ATTRACTIONS: Attraction\[\] = (\[[\s\S]*\]);/);

if (!jsonMatch) {
  console.error("Could not parse MOCK_ATTRACTIONS");
  process.exit(1);
}

const mockAttractions = eval(jsonMatch[1]);

async function run() {
  console.log('Fetching attractions from Supabase...');
  const { data: attractions, error } = await supabase.from('attractions').select('id, name, description, tips');
  
  if (error) {
    console.error('Error fetching attractions:', error);
    return;
  }

  let updated = 0;

  for (const attr of attractions) {
    const mockAttr = mockAttractions.find(m => m.id === attr.id || m.name === attr.name);
    
    let shortDesc = mockAttr ? mockAttr.description : '暂无简介';
    let detailDesc = attr.description; // 当前的 description 存的是几百字的百科长文
    
    // 如果长文其实是短文（未拉取到百科），就保持一致
    if (!detailDesc || detailDesc.length < 50) {
      detailDesc = shortDesc;
    }

    const { error: updateError } = await supabase.from('attractions').update({
      description: shortDesc,
      tips: detailDesc
    }).eq('id', attr.id);

    if (updateError) {
      console.error(`Failed to update ${attr.name}:`, updateError.message);
    } else {
      updated++;
      if (updated % 50 === 0) {
        console.log(`Updated ${updated}/${attractions.length}`);
      }
    }
  }

  console.log(`Finished migrating descriptions for ${updated} attractions!`);
}

run();