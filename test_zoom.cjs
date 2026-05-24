const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to footprint page...');
    await page.goto('http://localhost:5175/footprint', { waitUntil: 'networkidle0' });
    
    // Check BMap constants
    const constants = await page.evaluate(() => {
      return {
        zoom: window.BMAP_NAVIGATION_CONTROL_ZOOM,
        bottomRight: window.BMAP_ANCHOR_BOTTOM_RIGHT
      };
    });
    console.log('BMap Constants:', constants);
    const zoomIn = await page.$('.BMap_stdMpZoomIn');
    if (zoomIn) {
      const box = await zoomIn.boundingBox();
      console.log('Zoom In button bounding box:', box);
    } else {
      console.log('No zoom in button found.');
    }
    
    // Check center element
    const centerEl = await page.evaluate(() => {
      const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      return el ? el.className || el.tagName : 'none';
    });
    console.log('Center element:', centerEl);
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();
