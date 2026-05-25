import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

const select = [
  'id',
  'name',
  'province',
  'city',
  'address',
  'latitude',
  'longitude',
  'image_url',
  'ticket_price',
  'open_time',
  'description',
  'tips',
  'features'
].join(',');

const url = `${supabaseUrl}/rest/v1/attractions?select=${encodeURIComponent(select)}&order=id.asc&limit=5000`;

const res = await fetch(url, {
  headers: {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    Accept: 'application/json'
  }
});

if (!res.ok) {
  const text = await res.text();
  throw new Error(`Supabase request failed: ${res.status} ${text}`);
}

const data = await res.json();

const outDir = path.join(process.cwd(), 'exports');
fs.mkdirSync(outDir, { recursive: true });

const jsonPath = path.join(outDir, 'attractions_core.json');
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');

const headers = [
  'ID',
  '名称',
  '省份',
  '城市',
  '地址',
  '纬度',
  '经度',
  '图片URL',
  '门票(元)',
  '开放时间',
  '描述',
  '简介(tips)',
  '特色(features)'
];

const normalize = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v;
  return String(v);
};

const values = [
  headers,
  ...data.map((row) => [
    normalize(row.id),
    normalize(row.name),
    normalize(row.province),
    normalize(row.city),
    normalize(row.address),
    normalize(row.latitude),
    normalize(row.longitude),
    normalize(row.image_url),
    normalize(row.ticket_price),
    normalize(row.open_time),
    normalize(row.description),
    normalize(row.tips),
    normalize(row.features)
  ])
];

const valuesPath = path.join(outDir, 'attractions_core.values.json');
fs.writeFileSync(valuesPath, JSON.stringify(values), 'utf-8');

process.stdout.write(
  JSON.stringify(
    {
      count: data.length,
      jsonPath,
      valuesPath
    },
    null,
    2
  )
);
