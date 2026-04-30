# Findings & Decisions

## Requirements

- 目标用户：个人消费者，管理自己的化妆品库存，避免过期浪费
- 核心功能：手动录入 + 淘宝链接解析（核心） + 保质期管理 + 库存清单
- 提醒方式：小程序内提醒 + 微信推送通知 + 自定义提醒时间
- 分类体系：预设分类（6个） + 用户自定义扩展
- 技术栈：微信小程序原生 + 微信云开发

## Research Findings

### 微信云开发
- 云函数支持定时触发器（cron），可用于每日状态更新
- 云数据库为 MongoDB，支持正则查询（用于关键词搜索）
- 云开发安全规则需特别配置 categories 集合（预设分类 _openid 为 "system"，需允许跨用户读取）
- 云函数通过 `productOps` 统一入口（action 参数分发），通过 `parseLink` 处理链接解析，通过 `reminder` 处理定时提醒

### 淘宝链接解析
- 淘宝商品链接格式多样：标准链接、短链（m.tb.cn）、淘口令
- 淘宝开放平台 API 需申请淘宝联盟开发者账号，有审核周期
- 降级方案：HTTP 抓取商品页 HTML → 解析 title/meta → 正则 + 品牌词库提取结构化信息
- 品牌词库约 200 个，存放在 utils/constants.js
- 规格提取正则：`\d+\s*(ml|ML|g|G|片|支|对)`

### 微信订阅消息
- 微信订阅消息为「一次性订阅」，每次用户授权获得一次发送机会
- 无法后台静默发送，需在前端引导用户授权
- 最佳授权时机：添加产品成功后、查看即将过期列表时
- 云函数可调用 subscribeMessage.send 发送

### 保质期计算
- 区分未开封保质期和开封后保质期
- 最终过期时间 = min(生产日期+未开封月数, 开封日期+开封后月数)
- expirationDate 由服务端（productOps 云函数）计算写入，保证一致性
- 前端 onShow 基于 expirationDate 实时计算剩余天数展示，不依赖 status 字段

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| 微信原生开发（非 Uni-app/Taro） | 与微信 API 兼容性最好，无编译层问题 |
| 微信云开发做后端 | 免运维、成本低、订阅消息原生支持 |
| productOps 统一入口 | 减少云函数数量，集中管理 CRUD 逻辑 |
| 服务端计算 expirationDate | 避免前端版本差异导致数据不一致 |
| 先实现抓取降级方案再接 API | 淘宝 API 审核周期不可控 |
| 前端 onShow 实时计算 vs 依赖 status | 避免 cron 更新间的 24h 延迟窗口 |
| 珊瑚粉 #FF6B8A 为主色 | Monument Valley 极简 + Duolingo 激励感，暖调美妆氛围 |
| 暖白 #FFFBF5 页面背景 | 避免纯白冰冷，保持年轻柔和 |
| 20px 卡片圆角 + 6px 进度条 | 圆润游戏风，不尖锐不幼稚 |
| SVG 图标替代 Emoji | 跨平台一致性，可控样式 |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| ui-ux-pro-max 脚本文件不存在 | 手动基于 SKILL.md 规则分析，生成设计系统 |

## Resources

- 设计规格：`docs/superpowers/specs/2026-03-31-cosmetics-manager-design.md`
- 设计系统 Master：`design-system/MASTER.md`
- 页面设计覆盖：`design-system/pages/{home,add,inventory,profile,detail,category}.md`
- 浏览器线框图：`.superpowers/brainstorm/2203-1774970558/page-wireframes.html`
- 浏览器设计系统展示：`.superpowers/brainstorm/2203-1774970558/design-system.html`

## Visual/Browser Findings

- 线框图展示了 4 个核心页面布局：首页仪表盘、添加页双模式、库存清单列表、个人中心设置
- 设计系统展示了完整色板（珊瑚粉/薰衣草紫/语义色/底色）、字体层级、组件风格（产品卡片、警告卡片、游戏化统计卡片）、几何装饰语言、设计规范速查、反模式清单

---
*Update this file after every 2 view/browser/search operations*
