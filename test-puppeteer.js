const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.toString()));
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  const content = await page.content();
  console.log("DOM LENGTH:", content.length);
  console.log("DOM PREVIEW:", content.substring(0, 1000));
  
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("BODY TEXT:", bodyText);
  
  await browser.close();
})();
