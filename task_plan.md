# Task Plan: CosmeticBox 化妆品管理微信小程序

## Goal

开发一个微信小程序，帮助个人消费者管理化妆品库存、追踪保质期、在产品即将过期时主动提醒。核心差异化功能是淘宝链接自动解析产品信息。

## Current Phase

Phase 9 (Phase 1-8 complete, 138 tests pass)

## Phases

### Phase 1: 项目脚手架与基础框架
- [ ] 初始化微信小程序项目结构（miniprogram + cloudfunctions）
- [ ] 配置 app.json（页面路由、TabBar、窗口样式）
- [ ] 编写 app.wxss 全局样式（设计系统 Token → WXSS 变量）
- [ ] 创建 utils/constants.js（状态枚举、预设分类、品牌词库）
- [ ] 创建 utils/date.js（过期时间计算工具函数）
- [ ] 初始化云开发环境配置
- **Status:** pending
- **依赖:** 无
- **产出:** 可运行的空项目骨架 + 工具函数

### Phase 2: 云函数 — productOps（产品 CRUD）
- [ ] 实现 action: "add" — 添加产品（含过期时间计算、状态初始化）
- [ ] 实现 action: "list" — 查询列表（分类/状态/关键词筛选 + 分页）
- [ ] 实现 action: "get" — 查询单个产品详情
- [ ] 实现 action: "update" — 更新产品（含过期时间重算）
- [ ] 实现 action: "updateStatus" — 标记用完/丢弃
- [ ] 实现 action: "delete" — 删除产品
- [ ] 创建数据库索引
- **Status:** pending
- **依赖:** Phase 1（constants.js, date.js）
- **产出:** 完整的产品 CRUD 云函数

### Phase 3: 前端页面 — 添加产品
- [ ] 实现添加页 UI（链接导入 / 手动录入双模式切换）
- [ ] 实现手动录入表单（品牌、名称、分类选择、规格、生产日期、保质期）
- [ ] 实现过期时间实时预览（date.js）
- [ ] 对接 productOps 云函数保存产品
- [ ] 实现保存成功反馈
- **Status:** pending
- **依赖:** Phase 2（productOps 云函数）
- **产出:** 可手动录入并保存产品的添加页

### Phase 4: 前端页面 — 库存清单 + 产品详情
- [ ] 实现库存页 UI（搜索栏、分类标签、状态过滤、产品卡片列表）
- [ ] 实现 product-card 组件（图标、名称、分类、进度条、状态）
- [ ] 实现 status-badge 组件
- [ ] 实现 category-tag 组件
- [ ] 对接 productOps.list 加载数据
- [ ] 实现产品详情页（查看信息、标记用完/丢弃、删除）
- **Status:** pending
- **依赖:** Phase 2, Phase 3（需要数据）
- **产出:** 完整的库存浏览和产品详情体验

### Phase 5: 前端页面 — 首页仪表盘
- [ ] 实现首页 UI（渐变背景 + 几何装饰）
- [ ] 实现统计卡片（在用数、注意数、安全率）
- [ ] 实现即将过期产品警告列表
- [ ] 实现最近添加产品列表
- [ ] 基于 expirationDate 实时计算剩余天数（不依赖 status 字段）
- **Status:** pending
- **依赖:** Phase 4（复用 product-card 组件）
- **产出:** 功能完整的首页仪表盘

### Phase 6: 前端页面 — 个人中心 + 分类管理
- [ ] 实现个人中心页（用户信息、库存统计、设置列表）
- [ ] 实现提醒设置（提前天数、推送开关、频率选择）
- [ ] 实现分类管理页（预设分类展示 + 自定义分类增删）
- [ ] 对接 reminder_settings 读写
- **Status:** pending
- **依赖:** Phase 2
- **产出:** 完整的个人中心和分类管理

### Phase 7: 云函数 — parseLink（淘宝链接解析）
- [ ] 实现 utils/parser.js 前端链接预处理（链接类型识别、URL 提取）
- [ ] 实现 parseLink 云函数（商品页抓取 + 标题解析）
- [ ] 实现品牌词库匹配逻辑
- [ ] 实现规格正则提取
- [ ] 对接添加页链接导入模式
- [ ] 实现解析失败降级提示
- **Status:** pending
- **依赖:** Phase 3（添加页 UI）
- **产出:** 淘宝链接粘贴自动解析功能

### Phase 8: 云函数 — reminder（定时提醒）
- [ ] 实现 reminder 云函数（状态批量更新逻辑）
- [ ] 配置定时触发器（每天 08:00）
- [ ] 实现微信订阅消息发送逻辑
- [ ] 在添加成功和查看过期列表时引导用户授权订阅消息
- **Status:** pending
- **依赖:** Phase 2, Phase 6（reminder_settings）
- **产出:** 自动状态更新 + 微信推送提醒

### Phase 9: 集成测试与打磨
- [ ] 全流程测试：添加产品 → 查看库存 → 查看详情 → 首页提醒
- [ ] 链接解析测试：多种淘宝链接格式
- [ ] 边界测试：空数据、已过期产品录入、开封保质期重算
- [ ] UI 走查：对照设计系统检查颜色、圆角、间距、动画
- [ ] 性能检查：长列表虚拟化、云函数响应时间
- **Status:** pending
- **依赖:** Phase 1-8 全部完成
- **产出:** 可发布的完整小程序

## Key Questions

1. 淘宝链接解析的实现路径？→ 先用商品页抓取 + 标题解析（降级方案），后续申请淘宝联盟 API
2. 微信订阅消息模板 ID？→ 需在微信公众平台申请，实现时使用占位符

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| 微信原生 + 云开发 | 免运维、生态集成好、个人开发者成本低 |
| 云数据库 MongoDB | 云开发内置、文档型适合灵活属性 |
| expirationDate 服务端计算 | 保证数据一致性，避免前端计算偏差 |
| onShow 实时计算剩余天数 | 避免依赖 cron 更新的 status 字段造成数据延迟 |
| 先实现抓取降级方案 | 淘宝 API 审核周期不可控，降级方案先保证功能可用 |
| 珊瑚粉主色 + 薰衣草紫辅色 | Monument Valley 几何极简 + Duolingo 激励感，避免传统管理软件冷蓝绿 |
| 暖白背景 #FFFBF5 | 避免纯白冰冷感，保持年轻温暖调性 |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| （暂无）| | |

## Notes

- 设计规格：`docs/superpowers/specs/2026-03-31-cosmetics-manager-design.md`
- 设计系统 Master：`design-system/MASTER.md`
- 页面设计覆盖：`design-system/pages/*.md`
- 实现时先读 MASTER.md，再读对应页面覆盖文件
- P0 功能在 Phase 1-5 完成，P1 功能在 Phase 6-8 补充
