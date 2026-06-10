# [OPEN] Auth And Guide Regression Debug

## Session
- session_id: `auth-guide-regression`

## Symptoms
- 线上环境当前无法正常登录，登录页可能长时间停留在“处理中...”。
- 3 天「AI 攻略」可以生成，但 10 天左右的长行程在本地和线上都明显更慢，且线上约 189 秒后返回 `502` / `AI 返回的行程结构不完整，请重试一次。`

## Hypotheses
1. `authStore` 中 `onAuthStateChange(async ...)` 里直接 await 资料查询，导致 Supabase Auth 事件回调链路阻塞，登录/注册 promise 无法及时完成。
2. 登录成功后 `getSession()` 或 `fetchProfileWithRetry()` 在浏览器端被坏 session / 竞态拖住，页面一直处于 loading。
3. 长行程 token 预算和重试预算过低，模型输出被截断或后半程 days 缺失，触发结构不完整。
4. 长行程重试 prompt 过于严格，但仍要求 3 套完整 10 天方案，导致二次请求继续超时或被截断。
5. 过滤逻辑 `buildMappedOptions()` 将模型返回的空 attractions/day 直接裁掉，进一步放大了长行程结构缺失。

## Plan
- 为认证和长行程生成链路添加最小运行时插桩
- 部署调试包到线上并复现登录与 10 天攻略
- 基于日志确定根因，再做最小修复
- 重新验证线上登录与 3 天 / 10 天攻略，再清理调试代码
