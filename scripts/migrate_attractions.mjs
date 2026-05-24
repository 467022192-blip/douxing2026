import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 读取 mockData.ts 并简单提取数据 (为了避免 ts-node 依赖，我们写个简单的正则或者直接从编译后的提取)
// 因为 mockAttractions.ts 是有效的 JSON 结构数组，我们可以用 eval 或正则
const mockDataContent = readFileSync(resolve(__dirname, '../src/data/mockAttractions.ts'), 'utf-8');
const jsonMatch = mockDataContent.match(/export const MOCK_ATTRACTIONS: Attraction\[\] = (\[[\s\S]*?\]);/);

let MOCK_ATTRACTIONS = [];
if (jsonMatch && jsonMatch[1]) {
  try {
    MOCK_ATTRACTIONS = eval(`(${jsonMatch[1]})`);
  } catch (e) {
    console.error('Failed to parse mock data');
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateData() {
  console.log(`Starting migration of ${MOCK_ATTRACTIONS.length} attractions...`);
  
  // 分批插入以避免请求过大
  const batchSize = 50;
  for (let i = 0; i < MOCK_ATTRACTIONS.length; i += batchSize) {
    const batch = MOCK_ATTRACTIONS.slice(i, i + batchSize);
    console.log(`Inserting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(MOCK_ATTRACTIONS.length/batchSize)}...`);
    
    const { data, error } = await supabase
      .from('attractions')
      .upsert(batch, { onConflict: 'id' });
      
    if (error) {
      console.error('Error inserting batch:', error);
      console.error('If this is a "relation does not exist" error, you need to create the tables in Supabase first.');
      return;
    }
  }
  
  console.log('Migration completed successfully!');
}

migrateData();
