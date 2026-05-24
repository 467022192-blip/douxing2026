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
  attractions = eval(`(${arrayStr})`);
}

const images = {
  palace: "https://images.unsplash.com/photo-1584315565803-5d58c2317c76?w=800&auto=format&fit=crop&q=80",
  temple: "https://images.unsplash.com/photo-1549405625-78e874cefb66?w=800&auto=format&fit=crop&q=80",
  garden: "https://images.unsplash.com/photo-1507208316335-8b1d960965d4?w=800&auto=format&fit=crop&q=80",
  wall: "https://images.unsplash.com/photo-1508804185872-d7bad8694002?w=800&auto=format&fit=crop&q=80",
  mountain: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80",
  lake: "https://images.unsplash.com/photo-1437482078695-73f5ca6c96e2?w=800&auto=format&fit=crop&q=80",
  pagoda: "https://images.unsplash.com/photo-1580145656108-a567634f19bd?w=800&auto=format&fit=crop&q=80",
  oldTown: "https://images.unsplash.com/photo-1552604617-eea98aa27234?w=800&auto=format&fit=crop&q=80",
  museum: "https://images.unsplash.com/photo-1518998053401-a4149019da8e?w=800&auto=format&fit=crop&q=80",
  city: "https://images.unsplash.com/photo-1508804185872-d7bad8694002?w=800&auto=format&fit=crop&q=80", // Using general landscape
  default1: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&auto=format&fit=crop&q=80",
  default2: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=800&auto=format&fit=crop&q=80"
};

attractions.forEach((a, i) => {
  const name = a.name;
  if (name.includes("故宫")) a.image_url = images.palace;
  else if (name.includes("天坛")) a.image_url = images.temple;
  else if (name.includes("颐和园")) a.image_url = images.garden;
  else if (name.includes("长城") || name.includes("八达岭")) a.image_url = images.wall;
  else if (name.includes("山") || name.includes("峡谷") || name.includes("峰")) a.image_url = images.mountain;
  else if (name.includes("湖") || name.includes("海") || name.includes("水") || name.includes("泉") || name.includes("瀑布")) a.image_url = images.lake;
  else if (name.includes("寺") || name.includes("庙") || name.includes("塔") || name.includes("石窟") || name.includes("观")) a.image_url = images.pagoda;
  else if (name.includes("古城") || name.includes("古镇") || name.includes("老街") || name.includes("里") || name.includes("巷")) a.image_url = images.oldTown;
  else if (name.includes("博物馆") || name.includes("纪念馆") || name.includes("旧址") || name.includes("陈列馆")) a.image_url = images.museum;
  else if (name.includes("公园") || name.includes("植物园") || name.includes("园")) a.image_url = images.garden;
  else a.image_url = i % 2 === 0 ? images.default1 : images.default2;
});

const updatedStr = JSON.stringify(attractions, null, 2);
const newContent = content.substring(0, startIndex) + updatedStr + content.substring(endIndex + 1);

fs.writeFileSync(filePath, newContent, 'utf-8');
console.log("Images updated successfully.");
