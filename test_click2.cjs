const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[BROWSER] ${msg.text()}`);
  });

  try {
    console.log('Navigating to footprint page...');
    await page.goto('http://localhost:5174/footprint', { waitUntil: 'networkidle0' });
    
    const btn = await page.$('button.text-purple-600');
    if (btn) {
      await page.evaluate(b => b.click(), btn);
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log('Clicking the label...');
    await page.evaluate(async () => {
      const labels = document.querySelectorAll('.BMapLabel');
      if (labels.length > 1) {
        labels[1].click();
      }
    });

    await new Promise(r => setTimeout(r, 2000));
    console.log('Navigated URL after click:', page.url());

  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();
