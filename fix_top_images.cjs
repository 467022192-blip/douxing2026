const fs = require('fs');
const filePath = 'src/data/mockAttractions.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const startIndex = content.indexOf('[');
const endIndex = content.lastIndexOf(']');
const arrayStr = content.substring(startIndex, endIndex + 1);
let attractions = eval(`(${arrayStr})`);

const realImages = {
  "故宫博物院": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Forbidden_City_Beijing_Shenwumen_Gate.JPG/800px-Forbidden_City_Beijing_Shenwumen_Gate.JPG",
  "天坛公园": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Temple_of_Heaven_2016.jpg/800px-Temple_of_Heaven_2016.jpg",
  "颐和园": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Summer_Palace_-_Kunming_Lake.jpg/800px-Summer_Palace_-_Kunming_Lake.jpg",
  "八达岭—慕田峪长城旅游区": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/The_Great_Wall_of_China_at_Jinshanling-edit.jpg/800px-The_Great_Wall_of_China_at_Jinshanling-edit.jpg",
  "承德避暑山庄及周围寺庙": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Chengde_Mountain_Resort.jpg/800px-Chengde_Mountain_Resort.jpg",
  "大同市云冈石窟": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Yungang_Grottoes_16.jpg/800px-Yungang_Grottoes_16.jpg",
  "黄山风景区": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Huangshan_pic_1.jpg/800px-Huangshan_pic_1.jpg",
  "杭州西湖风景名胜区": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/West_Lake_in_Hangzhou.jpg/800px-West_Lake_in_Hangzhou.jpg",
  "苏州西湖": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/West_Lake_in_Hangzhou.jpg/800px-West_Lake_in_Hangzhou.jpg",
  "秦始皇兵马俑博物馆": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Terracotta_Army%2C_Pit_1.jpg/800px-Terracotta_Army%2C_Pit_1.jpg",
  "九寨沟风景名胜区": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Jiuzhaigou_Valley_National_Park.jpg/800px-Jiuzhaigou_Valley_National_Park.jpg",
  "布达拉宫风景名胜区": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Potala_Palace_2012.jpg/800px-Potala_Palace_2012.jpg",
  "丽江古城": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Lijiang_Old_Town_2.jpg/800px-Lijiang_Old_Town_2.jpg",
  "桂林玉龙雪山": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Jade_Dragon_Snow_Mountain_2010.jpg/800px-Jade_Dragon_Snow_Mountain_2010.jpg"
};

attractions.forEach(a => {
  // Use real images if available
  for (const [key, url] of Object.entries(realImages)) {
    if (a.name.includes(key) || key.includes(a.name)) {
      a.image_url = url;
    }
  }
  
  // If still using unsplash, ensure it's heavily compressed
  if (a.image_url && a.image_url.includes('unsplash.com')) {
    a.image_url = a.image_url.replace(/w=\d+/, 'w=400').replace(/q=\d+/, 'q=60');
  }
});

const updatedStr = JSON.stringify(attractions, null, 2);
const newContent = content.substring(0, startIndex) + updatedStr + content.substring(endIndex + 1);
fs.writeFileSync(filePath, newContent, 'utf-8');
console.log("Top attractions updated with real Wikipedia images and all Unsplash fallbacks compressed.");
