const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
  
  await page.goto('http://localhost:5177/footprint', { waitUntil: 'networkidle0' });
  
  const mapElement = await page.$('.BMap_mask');
  const box = await mapElement.boundingBox();
  console.log('Map bounding box:', box);
  
  const elements = await page.evaluate((x, y) => {
    return document.elementsFromPoint(x, y).map(el => ({
      tagName: el.tagName,
      className: el.className,
      id: el.id
    }));
  }, box.x + box.width / 2, box.y + box.height / 2);
  
  console.log('Elements at map center:', elements);
  
  await browser.close();
})();
