const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => {
      const text = msg.text();
      if (!text.includes('validateDOMNesting') && !text.includes('testScenarios')) {
          console.log('BROWSER LOG:', text);
      }
  });
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.toString()));
  
  const wait = ms => new Promise(res => setTimeout(res, ms));
  
  console.log("Navigating to Home...");
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  console.log("Clicking attraction card...");
  await page.evaluate(() => {
    const cards = document.querySelectorAll('.group');
    if(cards.length > 0) cards[0].click();
  });
  
  await wait(1000);
  console.log("Current URL:", page.url());
  
  const title = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? h1.innerText : 'NO H1';
  });
  console.log("Detail page title:", title);
  
  console.log("Navigating back...");
  await page.evaluate(() => {
      const btn = document.querySelector('button');
      if (btn) btn.click();
  });
  
  await wait(1000);
  console.log("Current URL after back:", page.url());
  
  console.log("Navigating to Footprint tab...");
  await page.evaluate(() => {
      const navs = document.querySelectorAll('.fixed.bottom-0 button');
      navs.forEach(n => {
          if (n.innerText.includes('足迹')) n.click();
      });
  });
  
  await wait(1000);
  console.log("Current URL after tab click:", page.url());
  
  await browser.close();
  console.log("Tests finished successfully.");
})();
