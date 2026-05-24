const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set viewport to simulate a mobile device
  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
  
  await page.goto('http://localhost:5177/footprint', { waitUntil: 'networkidle0' });
  
  // Wait for the map to load
  await page.waitForFunction(() => window.testMapInstance && window.testMapInstance.getZoom());
  
  const initialZoom = await page.evaluate(() => window.testMapInstance.getZoom());
  console.log('Initial zoom:', initialZoom);
  
  const mapElement = await page.$('.BMap_mask');
  const box = await mapElement.boundingBox();
  
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  
  // Simulate pinch-to-zoom by dispatching touch events directly to the map mask
  await page.evaluate((cx, cy) => {
    const mask = document.querySelector('.BMap_mask');
    
    const touch1 = new Touch({
      identifier: 1,
      target: mask,
      clientX: cx - 50,
      clientY: cy,
      pageX: cx - 50,
      pageY: cy,
    });
    
    const touch2 = new Touch({
      identifier: 2,
      target: mask,
      clientX: cx + 50,
      clientY: cy,
      pageX: cx + 50,
      pageY: cy,
    });
    
    const touchStartEvent = new TouchEvent('touchstart', {
      cancelable: true,
      bubbles: true,
      touches: [touch1, touch2],
      targetTouches: [touch1, touch2],
      changedTouches: [touch1, touch2],
    });
    
    mask.dispatchEvent(touchStartEvent);
    
    // Move touches apart to zoom in
    const touch1Move = new Touch({
      identifier: 1,
      target: mask,
      clientX: cx - 100,
      clientY: cy,
      pageX: cx - 100,
      pageY: cy,
    });
    
    const touch2Move = new Touch({
      identifier: 2,
      target: mask,
      clientX: cx + 100,
      clientY: cy,
      pageX: cx + 100,
      pageY: cy,
    });
    
    const touchMoveEvent = new TouchEvent('touchmove', {
      cancelable: true,
      bubbles: true,
      touches: [touch1Move, touch2Move],
      targetTouches: [touch1Move, touch2Move],
      changedTouches: [touch1Move, touch2Move],
    });
    
    mask.dispatchEvent(touchMoveEvent);
    
    const touchEndEvent = new TouchEvent('touchend', {
      cancelable: true,
      bubbles: true,
      touches: [],
      targetTouches: [],
      changedTouches: [touch1Move, touch2Move],
    });
    
    mask.dispatchEvent(touchEndEvent);
  }, centerX, centerY);
  
  await new Promise(r => setTimeout(r, 1000));
  
  const newZoom = await page.evaluate(() => window.testMapInstance.getZoom());
  console.log('New zoom after pinch:', newZoom);
  
  if (newZoom !== initialZoom) {
    console.log('SUCCESS: Pinch-to-zoom worked!');
  } else {
    console.log('FAILED: Pinch-to-zoom did not change zoom level.');
  }
  
  await browser.close();
})();
