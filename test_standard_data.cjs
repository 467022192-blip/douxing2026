const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Footprint]') || text.includes('[RoutePlanning]') || text.includes('模拟数据已加载')) {
      console.log('BROWSER LOG:', text);
    }
  });
  
  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
  
  console.log('=== 准备环境 ===');
  await page.goto('http://localhost:5179/footprint', { waitUntil: 'networkidle0' });
  
  // 注入登录状态
  await page.evaluate(() => {
    localStorage.setItem('auth-storage-local', JSON.stringify({
      state: { isAuthenticated: true, user: { id: 'test', nickname: 'Test' } },
      version: 0
    }));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  
  // 点击生成标准数据（30想去，20去过）
  console.log('正在更新测试数据 (30个想去，20个去过)...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const testBtn = buttons.find(b => b.textContent.includes('生成标准数据'));
    if (testBtn) testBtn.click();
  });
  
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('\n=== 验证「足迹」页面 ===');
  const footprintState = await page.evaluate(() => {
    const filterBar = document.querySelector('.absolute.top-0.left-0.right-0 .flex.gap-2');
    if (!filterBar) return 'No filter bar found';
    const buttons = Array.from(filterBar.querySelectorAll('button'));
    const order = buttons.map(b => b.textContent.trim().split(' ')[0]);
    const selected = buttons.find(b => b.className.includes('bg-blue-500') || b.className.includes('bg-amber-500') || b.className.includes('bg-emerald-500'));
    
    // 获取每个按钮的数字
    const counts = buttons.map(b => b.textContent.trim());
    return {
      counts,
      order,
      selected: selected ? selected.textContent.trim().split(' ')[0] : 'None'
    };
  });
  console.log('DOM 状态:', footprintState);
  
  console.log('\n=== 验证「路线规划」页面 ===');
  await page.goto('http://localhost:5179/route-planning', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  
  const routePlanningState = await page.evaluate(() => {
    const filterBar = document.querySelector('.flex.gap-2.p-4.border-b');
    if (!filterBar) return 'No filter bar found';
    const buttons = Array.from(filterBar.querySelectorAll('button'));
    const order = buttons.map(b => b.textContent.trim());
    const selected = buttons.find(b => b.className.includes('bg-blue-500'));
    return {
      order,
      selected: selected ? selected.textContent.trim() : 'None'
    };
  });
  console.log('DOM 状态:', routePlanningState);
  
  await browser.close();
})();
