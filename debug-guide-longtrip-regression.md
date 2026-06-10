# [OPEN] Guide Long Trip Regression Debug

## Session
- session_id: `guide-longtrip-regression`

## Symptom
- 10 天左右的「AI 攻略」生成在本地和线上都更慢，且最终返回：`AI 返回的行程结构不完整，请重试一次。`

## Hypotheses
1. 长行程压缩后的 token 预算过低，模型返回被截断或后半段天数缺失。
2. 结构重试 prompt 过于紧，导致合法 JSON 通过，但 `days` 数量不足 10。
3. 长行程的首轮与重试轮都成功返回内容，但 `buildMappedOptions()` 过滤掉了部分空 attractions，最终触发结构不完整。
4. 生成链路去掉景区匹配后虽然减少了 `matchMs`，但模型稳定性下降，长行程更容易输出空天数或空 attractions。
5. 某次线上发布后，长行程请求实际走到了旧 bundle 或旧 serverless 版本，导致本地/线上表现与当前代码不一致。

## Plan
- 为长行程生成链路添加最小运行时插桩
- 复现 10 天请求并收集首轮/重试轮证据
- 基于证据做最小修复
- 验证本地与线上 10 天请求
