/**
 * 预计用时显示测试工具
 * 在浏览器控制台运行以下代码来测试各种时长的显示效果
 */

// 模拟 formatDuration 函数
const formatDuration = (minutes: number, short: boolean = false): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  if (short) {
    if (days > 0) {
      return `${days}天${remainingHours}时`;
    }
    if (hours > 0) {
      return `${hours}小时${mins > 0 ? mins + '分' : ''}`;
    }
    return `${mins}分钟`;
  }
  
  if (days > 0) {
    return `${days}天${remainingHours}小时${mins > 0 ? mins + '分' : ''}`;
  }
  if (hours > 0) {
    return `${hours}小时${mins > 0 ? mins + '分' : ''}`;
  }
  return `${mins}分钟`;
};

// 测试用例
const testCases = [
  { name: '30分钟', minutes: 30 },
  { name: '1小时', minutes: 60 },
  { name: '1小时30分', minutes: 90 },
  { name: '5小时', minutes: 300 },
  { name: '10小时', minutes: 600 },
  { name: '1天', minutes: 1440 },
  { name: '1天6小时', minutes: 1800 },
  { name: '2天', minutes: 2880 },
  { name: '2天6小时', minutes: 3240 },
  { name: '3天', minutes: 4320 },
  { name: '3天12小时', minutes: 5040 },
  { name: '5天', minutes: 7200 },
];

console.log('=== 预计用时显示测试 ===\n');

console.log('短格式（用于统计卡片）：');
testCases.forEach(test => {
  console.log(`${test.name.padEnd(12)} -> ${formatDuration(test.minutes, true)}`);
});

console.log('\n长格式（用于详细展示）：');
testCases.forEach(test => {
  console.log(`${test.name.padEnd(12)} -> ${formatDuration(test.minutes, false)}`);
});

console.log('\n=== 测试完成 ===');

// 导出供其他模块使用
export { formatDuration, testCases };
