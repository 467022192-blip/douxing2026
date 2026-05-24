import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as XLSX from 'xlsx';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function exportToExcel() {
  console.log('正在从 Supabase 获取景区数据...');
  
  const { data: attractions, error } = await supabase
    .from('attractions')
    .select('id, name, province, city, description, tips')
    .order('id');

  if (error) {
    console.error('获取数据失败:', error);
    return;
  }

  console.log(`成功获取 ${attractions.length} 条景区数据，正在生成 Excel...`);

  // 格式化导出的数据
  const excelData = attractions.map(attr => ({
    'ID': attr.id,
    '省份': attr.province,
    '城市': attr.city,
    '景区名称': attr.name,
    '一句话短简介 (description)': attr.description,
    '长文详细介绍 (tips)': attr.tips
  }));

  // 创建工作簿和工作表
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // 设置列宽，方便阅读
  const wscols = [
    { wch: 5 },   // ID
    { wch: 10 },  // 省份
    { wch: 10 },  // 城市
    { wch: 25 },  // 景区名称
    { wch: 40 },  // 短简介
    { wch: 100 }  // 长文介绍
  ];
  worksheet['!cols'] = wscols;

  // 将工作表添加到工作簿
  XLSX.utils.book_append_sheet(workbook, worksheet, '景区数据列表');

  // 写入文件
  const outputPath = './景区长文数据抽检表.xlsx';
  XLSX.writeFile(workbook, outputPath);

  console.log(`✅ 导出成功！文件已保存至: ${outputPath}`);
}

exportToExcel();
