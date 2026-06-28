# Findings & Decisions

## Requirements (本次任务)
- MiMo 只提取包装日期字符串（packageDate），不再判断生产/到期语义
- 云函数根据"与今天比较"推断日期含义
- 未来日期 → 有效期至 → 反推生产日期（默认 36 月）
- 过去日期 → 生产日期
- 表单保持不变（productionDate + shelfLifeMonths）
- packageDate 瞬态字段，不持久化到产品记录

## Research Findings
- MiMo Vision API `image_url` 格式比 Markdown inline 省 ~127x token
- 当前 MiMo 对中文"限期使用日期"/"生产日期"区分能力弱（测试中两个都返回 null）
- addMonths 可复用：传入负值即 subtractMonths
- 现有 date.js 已导出 addMonths，index.js 已 require date.js

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 推断逻辑放云函数端 | 业务逻辑集中，前端简单，多端一致 |
| 单一 packageDate 字段 | 简化 MiMo 任务，提高提取成功率 |
| 默认 36 月保质期 | 化妆品行业惯例 |
| 表单不变 | 最小化前端改动，用户习惯不变 |
| packageDate 不持久化 | 仅用于推断，产品记录中已有 productionDate + expirationDate |

## Spec Reference
`docs/superpowers/specs/2026-06-28-package-date-inference-design.md`
