const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to RoutePlanning page...');
    await page.goto('http://localhost:5175/route-planning', { waitUntil: 'networkidle0' });

    // Click on the center of the screen
    const centerEl = await page.evaluate(() => {
      const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      return el ? el.className || el.tagName : 'none';
    });
    console.log('Center element on RoutePlanning:', centerEl);
    
    // Check if BMap_mask exists and its dimensions
    const maskInfo = await page.evaluate(() => {
      const el = document.querySelector('.BMap_mask');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height, display: getComputedStyle(el).display };
    });
    console.log('BMap_mask info:', maskInfo);

  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();
