const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
  
  await page.goto('http://localhost:5177/footprint', { waitUntil: 'networkidle0' });
  
  await page.waitForFunction(() => window.testMapInstance && window.testMapInstance.getCenter());
  
  const initialCenter = await page.evaluate(() => window.testMapInstance.getCenter());
  console.log('Initial center:', initialCenter);
  
  const mapElement = await page.$('.BMap_mask');
  const box = await mapElement.boundingBox();
  
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  
  const touchscreen = page.touchscreen;
  await touchscreen.touchStart(startX, startY);
  await touchscreen.touchMove(startX - 100, startY - 100);
  await touchscreen.touchEnd();
  
  await new Promise(r => setTimeout(r, 1000));
  
  const newCenter = await page.evaluate(() => window.testMapInstance.getCenter());
  console.log('New center after drag:', newCenter);
  
  if (Math.abs(newCenter.lng - initialCenter.lng) > 0.001 || Math.abs(newCenter.lat - initialCenter.lat) > 0.001) {
    console.log('SUCCESS: Dragging worked!');
  } else {
    console.log('FAILED: Dragging did not change map center.');
  }
  
  await browser.close();
})();
