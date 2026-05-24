const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.toString()));
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  const content = await page.evaluate(() => document.getElementById('root').innerHTML);
  console.log("ROOT HTML:");
  console.log(content.substring(0, 2000)); // Only log first 2000 chars
  
  await browser.close();
})();
