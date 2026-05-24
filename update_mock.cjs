const fs = require('fs');

const filePath = 'src/data/mockAttractions.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const startIndex = content.indexOf('[');
const endIndex = content.lastIndexOf(']');
if (startIndex === -1 || endIndex === -1) {
  console.error("Array not found");
  process.exit(1);
}

const arrayStr = content.substring(startIndex, endIndex + 1);
let attractions;
try {
  attractions = JSON.parse(arrayStr);
} catch (e) {
  console.log("JSON parse failed, trying eval...");
  attractions = eval(`(${arrayStr})`);
}

attractions.forEach(a => {
  if (a.name.includes("云冈石窟")) {
    a.open_time = "旺季 08:30-17:30 | 淡季 08:30-17:00 (提前30-60分钟停止入园)";
    a.price_desc = "旺季 120元/人 | 淡季 100元/人";
    a.ticket_price = 120;
    a.description = "中国四大石窟之一，佛教艺术宝库";
    return;
  }
  
  if (a.name.includes("故宫") || a.name.includes("天坛") || a.name.includes("颐和园") || a.name.includes("八达岭")) {
      return;
  }

  const name = a.name;
  
  if (name.includes("博物馆") || name.includes("纪念馆") || name.includes("旧址") || name.includes("故居") || name.includes("陈列馆") || name.includes("陵园")) {
    a.open_time = "09:00-17:00 (16:00停止入馆，周一闭馆)";
    if (!a.price_desc) a.price_desc = "免费或特展约 50-80 元";
  } 
  else if (name.includes("公园") || name.includes("植物园") || name.includes("湖") || name.includes("海") || name.includes("潭")) {
    a.open_time = "06:00-22:00 (内部景点约17:00关闭)";
    if (!a.price_desc) a.price_desc = "免费或基础票约 20-50 元";
  }
  else if (name.includes("山") || name.includes("峡谷") || name.includes("森林") || name.includes("沟") || name.includes("洞") || name.includes("峰")) {
    a.open_time = "旺季 07:00-18:00 | 淡季 08:00-17:00";
    if (!a.price_desc) a.price_desc = `旺季约 ${Math.max(80, Math.floor(Math.random()*150 + 50))}元 | 淡季有所下调`;
  }
  else if (name.includes("游乐") || name.includes("欢乐谷") || name.includes("乐园") || name.includes("度假区") || name.includes("影视城") || name.includes("世界")) {
    a.open_time = "09:00-21:30 (部分项目开放时间以当日公告为准)";
    if (!a.price_desc) a.price_desc = "全日票约 200-300 元";
  }
  else if (name.includes("寺") || name.includes("庙") || name.includes("塔") || name.includes("观") || name.includes("祠") || name.includes("宫")) {
    a.open_time = "08:00-17:30";
    if (!a.price_desc) a.price_desc = "约 40-80 元/人";
  }
  else if (name.includes("古城") || name.includes("古镇") || name.includes("街") || name.includes("里") || name.includes("巷")) {
    a.open_time = "全天开放 (内部小景点 08:30-17:30)";
    if (!a.price_desc) a.price_desc = "大景区免费，内部景点联票约 80-120 元";
  }
  else {
    a.open_time = "08:30-17:30 (17:00停止入园)";
    if (!a.price_desc) a.price_desc = `约 ${Math.floor(Math.random()*100 + 40)} 元/人`;
  }

  if (a.description && a.description.includes("中国5A级景区，位于")) {
     let featureStr = a.features ? a.features.replace('5A级景区、', '').replace('5A级景区', '') : '';
     if (featureStr === '') featureStr = '著名的历史文化与自然风景胜地';
     a.description = `${a.province}著名地标，${featureStr}。`;
  }
});

const updatedStr = JSON.stringify(attractions, null, 2);
const newContent = content.substring(0, startIndex) + updatedStr + content.substring(endIndex + 1);

fs.writeFileSync(filePath, newContent, 'utf-8');
console.log("Mock data updated successfully.");
