const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1024, height: 768 });
  
  await page.goto('http://localhost:5177/footprint', { waitUntil: 'networkidle0' });
  
  await page.waitForFunction(() => window.testMapInstance && window.testMapInstance.getCenter());
  
  const initialCenter = await page.evaluate(() => window.testMapInstance.getCenter());
  console.log('Initial center (desktop):', initialCenter);
  
  await page.evaluate(() => {
    const mask = document.querySelector('.BMap_mask');
    const rect = mask.getBoundingClientRect();
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    
    const mousedown = new MouseEvent('mousedown', {
      bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0
    });
    mask.dispatchEvent(mousedown);
    
    const mousemove = new MouseEvent('mousemove', {
      bubbles: true, cancelable: true, clientX: cx - 100, clientY: cy - 100, button: 0
    });
    mask.dispatchEvent(mousemove);
    
    const mouseup = new MouseEvent('mouseup', {
      bubbles: true, cancelable: true, clientX: cx - 100, clientY: cy - 100, button: 0
    });
    mask.dispatchEvent(mouseup);
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  const newCenter = await page.evaluate(() => window.testMapInstance.getCenter());
  console.log('New center after drag (desktop):', newCenter);
  
  if (Math.abs(newCenter.lng - initialCenter.lng) > 0.001 || Math.abs(newCenter.lat - initialCenter.lat) > 0.001) {
    console.log('SUCCESS: DOM event dragging worked!');
  } else {
    console.log('FAILED: DOM event dragging did not change map center.');
  }
  
  await browser.close();
})();
