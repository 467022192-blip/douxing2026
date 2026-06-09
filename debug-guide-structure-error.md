# [OPEN] Guide Structure Error Debug

## Session
- session_id: `guide-structure-error`

## Symptom
- 线上重试「攻略」AI 生成时，接口偶发返回：`AI 返回的行程结构不完整，请重试一次。`

## Hypotheses
1. 模型返回了合法 JSON，但某个方案的 `days` 为空或不是数组。
2. 模型返回了 3 个方案，但某些 `day.attractions` 为空，经过过滤后整套方案被清空。
3. 容错 JSON 修复把内容解析成功了，但字段层级被修坏，导致 `days/attractions` 丢失。
4. 二次重试 prompt 虽然得到合法 JSON，但没有强约束“每个方案至少有 1 天、每天至少 1 个景点”。
5. 匹配或清洗阶段只保留 `name` 非空景点，导致原本有内容的日程在映射后被清空。

## Plan
- 为服务端生成链路添加最小运行时插桩
- 复现线上生成并读取日志
- 基于证据做最小修复
- 再次验证并对比修复前后行为
