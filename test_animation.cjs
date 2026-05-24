const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  // 1. 设置 1 个想去的初始状态
  await page.goto('http://localhost:5179/footprint', { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    localStorage.setItem('auth-storage-local', JSON.stringify({
      state: { isAuthenticated: true, user: { id: 'test', nickname: 'Test' } },
      version: 0
    }));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const testBtn = buttons.find(b => b.textContent.includes('测试：仅1个想去'));
    if (testBtn) testBtn.click();
  });
  
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  
  // 2. 进入路线规划页面
  await page.goto('http://localhost:5179/route-planning', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  
  const getOrder = async () => {
    return page.evaluate(() => {
      const filterBar = document.querySelector('.flex.gap-2.p-4.border-b');
      if (!filterBar) return [];
      return Array.from(filterBar.querySelectorAll('button')).map(b => b.textContent.trim());
    });
  };
  
  console.log('当前想去=1，按钮顺序:', await getOrder());
  
  // 3. 点击列表中的第一个爱心，添加一个想去（变为2）
  console.log('点击列表中的空心爱心，将想去数量增加到2...');
  await page.evaluate(() => {
    // 找到包含推荐景点的按钮并点击切换到推荐（如果当前是想去）
    const tabs = Array.from(document.querySelectorAll('.flex.gap-2.p-4.border-b button'));
    const recTab = tabs.find(t => t.textContent.trim() === '推荐');
    if (recTab) recTab.click();
  });
  
  await new Promise(r => setTimeout(r, 500));
  
  await page.evaluate(() => {
    // 找到未被选中的爱心按钮
    const hearts = Array.from(document.querySelectorAll('.flex-1.overflow-y-auto button')).filter(btn => {
      const svg = btn.querySelector('svg');
      return svg && svg.getAttribute('fill') === 'none';
    });
    if (hearts.length > 0) {
      hearts[0].click();
    }
  });
  
  await new Promise(r => setTimeout(r, 500));
  
  console.log('当前想去=2，按钮顺序:', await getOrder());
  
  await browser.close();
})();
