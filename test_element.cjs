const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1024, height: 768 });
  
  await page.goto('http://localhost:5177/footprint', { waitUntil: 'networkidle0' });
  
  const elements = await page.evaluate(() => {
    return document.elementsFromPoint(512, 384).map(el => ({
      tagName: el.tagName,
      className: el.className,
      id: el.id
    }));
  });
  
  console.log('Elements at center:', elements);
  
  await browser.close();
})();
