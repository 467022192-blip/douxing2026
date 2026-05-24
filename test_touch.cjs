const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Emulate touch device
  const iPhone = puppeteer.KnownDevices['iPhone 11'];
  await page.emulate(iPhone);
  
  page.on('console', msg => {
    console.log(`[BROWSER] ${msg.text()}`);
  });

  try {
    console.log('Navigating to test page...');
    await page.goto('http://localhost:5176/test_bmap.html', { waitUntil: 'networkidle0' });
    
    // Dispatch touch events
    console.log('Dispatching touch events...');
    await page.evaluate(() => {
      const mapEl = document.getElementById('map');
      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [new Touch({ identifier: 1, target: mapEl, clientX: 100, clientY: 100 })],
        bubbles: true, cancelable: true
      });
      mapEl.dispatchEvent(touchStartEvent);
      
      const touchMoveEvent = new TouchEvent('touchmove', {
        touches: [new Touch({ identifier: 1, target: mapEl, clientX: 150, clientY: 150 })],
        bubbles: true, cancelable: true
      });
      mapEl.dispatchEvent(touchMoveEvent);
    });

    await new Promise(r => setTimeout(r, 1000));
    console.log('Test completed.');
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();
