const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  await page.evaluate(() => {
    if (window.testScenarios) {
      window.testScenarios.clearCheckins();
      window.testScenarios.addMockCheckins();
    }
  });
  
  console.log("Injected test data successfully via Puppeteer!");
  await browser.close();
})();
