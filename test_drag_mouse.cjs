const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1024, height: 768 });
  
  await page.goto('http://localhost:5177/footprint', { waitUntil: 'networkidle0' });
  
  await page.waitForFunction(() => window.testMapInstance && window.testMapInstance.getCenter());
  
  const initialCenter = await page.evaluate(() => window.testMapInstance.getCenter());
  console.log('Initial center (desktop):', initialCenter);
  
  const mapElement = await page.$('.BMap_mask');
  const box = await mapElement.boundingBox();
  
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 100, startY - 100, { steps: 10 });
  await page.mouse.up();
  
  await new Promise(r => setTimeout(r, 1000));
  
  const newCenter = await page.evaluate(() => window.testMapInstance.getCenter());
  console.log('New center after drag (desktop):', newCenter);
  
  if (Math.abs(newCenter.lng - initialCenter.lng) > 0.001 || Math.abs(newCenter.lat - initialCenter.lat) > 0.001) {
    console.log('SUCCESS: Mouse dragging worked!');
  } else {
    console.log('FAILED: Mouse dragging did not change map center.');
  }
  
  await browser.close();
})();
