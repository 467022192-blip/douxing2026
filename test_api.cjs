const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5177/footprint', { waitUntil: 'networkidle0' });
  
  const methods = await page.evaluate(() => {
    const map = window.testMapInstance;
    return {
      enableDragging: typeof map.enableDragging,
      enablePinchToZoom: typeof map.enablePinchToZoom,
      enableScrollWheelZoom: typeof map.enableScrollWheelZoom
    };
  });
  
  console.log('Map methods:', methods);
  
  await browser.close();
})();
