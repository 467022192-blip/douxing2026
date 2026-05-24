const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => {
      const text = msg.text();
      if (!text.includes('validateDOMNesting') && !text.includes('testScenarios')) {
          console.log(text);
      }
  });
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(res => setTimeout(res, 2000)); // wait for logs
  
  await browser.close();
})();
