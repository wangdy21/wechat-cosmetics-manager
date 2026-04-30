# 化妆品管理微信小程序 — 设计规格

## 概述

一款面向个人消费者的微信小程序，帮助用户管理化妆品库存、追踪保质期、在产品即将过期时主动提醒，减少过期浪费。核心差异化功能是通过粘贴淘宝商品链接自动解析产品信息，降低录入成本。

## 目标用户

个人消费者（主要为女性用户），拥有多件化妆品，希望：
- 清楚知道每件产品的过期时间
- 在产品过期前收到提醒
- 快速录入新购买的产品，减少手动输入

## 技术选型

| 层次 | 选择 | 理由 |
|------|------|------|
| 前端 | 微信小程序原生（WXML + WXSS + JS） | 与微信生态深度集成，对小程序 API 兼容性最好 |
| 后端 | 微信云开发（云函数 + 云数据库 + 云存储） | 免运维，个人开发者成本低，订阅消息原生支持 |
| 数据库 | 云数据库（MongoDB） | 云开发内置，文档型适合灵活的产品属性存储 |
| 文件存储 | 云存储 | 用于产品图片 |

## 页面结构

### Tab 页面（底部导航）

| Tab | 路径 | 功能 |
|-----|------|------|
| 首页 | `/pages/home/home` | 概览仪表盘：即将过期产品警告、库存统计卡片、最近添加 |
| 添加 | `/pages/add/add` | 产品录入：淘宝链接粘贴解析 + 手动表单录入，双模式切换 |
| 库存 | `/pages/inventory/inventory` | 全部产品清单：分类筛选、搜索、状态过滤（在用/即将过期/已过期） |
| 我的 | `/pages/profile/profile` | 个人设置：提醒偏好、分类管理入口、库存统计、数据导出 |

### 子页面

| 路径 | 功能 |
|------|------|
| `/pages/detail/detail` | 产品详情：查看完整信息、标记用完/丢弃、删除（编辑功能为 P2） |
| `/pages/category/category` | 分类管理：查看预设分类、新增/编辑/删除自定义分类 |

## 数据库设计

### `products` 集合

存储用户的化妆品信息，每条记录绑定用户 openid。

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 自动生成 |
| `_openid` | string | 用户标识，云开发自动注入 |
| `name` | string | 产品名称 |
| `brand` | string | 品牌 |
| `category` | string | 分类名称（护肤/彩妆/美发等） |
| `specification` | string | 规格（如 230ml、50g） |
| `imageUrl` | string | 产品图片的云存储路径 |
| `sourceLink` | string | 来源淘宝链接（如有） |
| `productionDate` | string | 生产日期，ISO 格式 YYYY-MM-DD |
| `shelfLifeMonths` | number | 未开封保质期（月） |
| `expirationDate` | string | 计算后的过期日期，ISO 格式。由 `productOps` 云函数在服务端计算写入 |
| `status` | string | 产品状态枚举。由 `productOps` 在创建时根据过期时间初始化 |
| `openedDate` | string\|null | 开封日期 |
| `openedShelfLifeMonths` | number\|null | 开封后保质期（月） |
| `createdAt` | string | 创建时间 |
| `updatedAt` | string | 最后更新时间 |

**`status` 枚举值：**
- `in_use` — 在用中
- `expiring_soon` — 即将过期（距过期日不足用户设定天数）
- `expired` — 已过期
- `used_up` — 已用完（用户主动标记）
- `discarded` — 已丢弃（用户主动标记）

**索引：**
- `_openid` + `status` 复合索引（首页按状态查询）
- `_openid` + `expirationDate` 复合索引（过期排序查询）
- `_openid` + `category` 复合索引（分类筛选）

### `categories` 集合

管理产品分类。预设分类全局共享，自定义分类按用户隔离。

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 自动生成 |
| `_openid` | string | 用户标识（预设分类为 "system"） |
| `name` | string | 分类名称 |
| `icon` | string | 分类图标（emoji 或图标标识） |
| `isPreset` | boolean | 是否为预设分类 |
| `sortOrder` | number | 排序权重 |

**预设分类（6 个）：** 护肤、彩妆、美发、身体护理、香水、工具

用户可新增自定义分类，不可删除或修改预设分类。

### `reminder_settings` 集合

每个用户一条记录，存储提醒偏好。

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 自动生成 |
| `_openid` | string | 用户标识 |
| `advanceDays` | number | 提前提醒天数，默认 30 |
| `enablePush` | boolean | 是否开启微信推送通知 |
| `pushFrequency` | string | 推送频率：daily / weekly |

## 核心业务逻辑

### `productOps` 云函数接口

统一的产品 CRUD 云函数，通过 `action` 参数区分操作。所有写操作在服务端计算 `expirationDate` 和初始 `status`，保证数据一致性。

**`action: "add"`** — 添加产品

入参：`{ name, brand, category, specification, sourceLink?, imageUrl?, productionDate, shelfLifeMonths, openedDate?, openedShelfLifeMonths? }`

服务端逻辑：
1. 根据过期时间计算规则计算 `expirationDate`
2. 根据 `expirationDate` 与当前日期及用户 `advanceDays` 设置，初始化 `status`（若已过期则直接设为 `expired`，若在提醒窗口内则设为 `expiring_soon`，否则为 `in_use`）
3. 注入 `_openid`、`createdAt`、`updatedAt`
4. 写入数据库，返回完整产品记录

**`action: "update"`** — 更新产品

入参：`{ _id, ...可更新字段 }`

服务端逻辑：
1. 校验 `_openid` 归属
2. 如果 `productionDate`、`shelfLifeMonths`、`openedDate`、`openedShelfLifeMonths` 中任何一个发生变更，重新计算 `expirationDate` 和 `status`
3. 更新 `updatedAt`

**`action: "updateStatus"`** — 用户主动标记状态

入参：`{ _id, status }`（仅允许 `used_up` 或 `discarded`）

**`action: "delete"`** — 删除产品

入参：`{ _id }`。校验 `_openid` 后删除。

**`action: "list"`** — 查询产品列表

入参：`{ category?, status?, keyword?, page?, pageSize? }`

返回：`{ list, total, page, pageSize }`

`keyword` 对 `name` 和 `brand` 做模糊匹配（使用正则）。

**`action: "get"`** — 查询单个产品详情

入参：`{ _id }`。返回完整产品记录。

### 淘宝链接解析

**前端与云函数的职责边界：**

前端 `utils/parser.js` 负责链接预处理：
1. 识别用户粘贴内容的类型（标准淘宝链接、短链、淘口令文本）
2. 从中提取有效 URL 或淘口令字符串
3. 将提取结果发送到 `parseLink` 云函数

云函数 `parseLink` 负责实际解析：
1. 接收前端传来的 URL 或淘口令
2. 如为短链/淘口令，解析获取真实商品链接
3. 从商品链接提取商品 ID
4. 调用淘宝 API 或抓取页面获取商品详情
5. 用品牌词库和正则规则结构化提取信息
6. 返回结构化数据：`{ name, brand, category, specification, imageUrl }`

**流程：**
1. 用户粘贴淘宝商品链接（支持标准链接和淘口令短链）
2. 前端提取链接发送到 `parseLink` 云函数
3. 云函数解析商品信息并返回结构化数据
4. 前端预填表单，用户确认或修改后保存

**解析策略（按优先级降级）：**

1. **淘宝开放平台 API**：使用淘宝联盟 `taobao.tbk.item.info.get` 接口，传入商品 ID 获取标题、图片、属性等。需提前申请淘宝联盟开发者账号。
2. **商品页抓取**：云函数通过 HTTP 请求获取商品页 HTML，解析 `<title>`、`<meta>` 标签和页面内嵌 JSON 数据提取商品信息。作为 API 不可用时的降级方案。
3. **标题智能解析**：获取商品标题后，用正则表达式 + 品牌词库匹配提取品牌、规格等结构化信息。

**品牌词库：** 内置常见化妆品品牌列表（SK-II、兰蔻、雅诗兰黛、MAC、YSL 等约 200 个），用于从商品标题中准确匹配品牌名。词库随版本更新。

**规格提取规则：** 正则匹配标题中的容量/重量模式，如 `\d+\s*(ml|ML|g|G|片|支|对)` 。

### 过期时间计算

核心规则：取「未开封过期时间」和「开封后过期时间」中更早的一个。

```
未开封过期时间 = 生产日期 + 保质期月数
开封后过期时间 = 开封日期 + 开封后保质期月数（如有）
最终过期时间 = min(未开封过期时间, 开封后过期时间)
```

当用户只填生产日期和保质期时，使用未开封过期时间。当用户后续记录了开封日期和开封保质期，系统自动重算并取更早值。

### 产品状态自动更新

`reminder` 云函数通过定时触发器每天执行一次（建议 08:00），执行以下逻辑：

1. 查询所有 `status` 为 `in_use` 的产品
2. 如果 `expirationDate` 已过 → 更新为 `expired`
3. 如果 `expirationDate` 距今不足用户设定的 `advanceDays` → 更新为 `expiring_soon`
4. 对状态变更为 `expiring_soon` 或 `expired` 的产品，检查用户是否开启推送
5. 对已授权的用户发送微信订阅消息

### 提醒机制

**小程序内提醒：**
- 每次 `onShow` 触发时，基于 `expirationDate` 字段直接计算剩余天数（不依赖 `status` 字段），避免定时任务与实时展示之间的数据延迟
- 首页顶部以警告卡片形式展示即将过期和已过期产品
- 产品卡片上显示剩余天数和颜色编码的进度条
- `status` 字段主要用于定时推送判断和库存列表的状态筛选，前端展示以实时计算为准

**微信订阅消息推送：**
- 使用微信「一次性订阅消息」能力
- 在两个时机引导用户授权：添加产品成功后、查看即将过期列表时
- 每次授权获得一次发送机会，用完需再次授权
- 定时云函数检查到期产品后，消耗授权发送消息

**颜色编码规则：**
- 绿色：剩余时间 > 提醒天数（安全）
- 橙色：剩余时间 <= 提醒天数（即将过期）
- 红色：已过期

## 项目结构

```
miniprogram/
├── app.js
├── app.json
├── app.wxss
├── pages/
│   ├── home/          # 首页 - 概览仪表盘
│   │   ├── home.wxml
│   │   ├── home.wxss
│   │   ├── home.js
│   │   └── home.json
│   ├── add/           # 添加产品
│   ├── inventory/     # 库存清单
│   ├── profile/       # 个人中心
│   ├── detail/        # 产品详情
│   └── category/      # 分类管理
├── components/
│   ├── product-card/  # 产品卡片组件
│   ├── status-badge/  # 状态标签组件
│   └── category-tag/  # 分类标签组件
├── utils/
│   ├── date.js        # 日期计算工具
│   ├── parser.js      # 链接预处理：识别链接类型、提取URL，发送给云函数
│   └── constants.js   # 常量定义（分类、状态枚举、品牌词库约200个）
└── images/

cloudfunctions/
├── parseLink/         # 淘宝链接解析
│   ├── index.js
│   └── package.json
├── reminder/          # 定时提醒与状态更新
│   ├── index.js
│   ├── config.json    # 定时触发器配置
│   └── package.json
└── productOps/        # 产品 CRUD 操作
    ├── index.js
    └── package.json
```

## 功能优先级

| 优先级 | 功能 | 说明 |
|--------|------|------|
| P0 | 手动录入产品 | 表单录入品牌、名称、分类、规格、生产日期、保质期 |
| P0 | 保质期计算与展示 | 根据生产日期和保质期自动计算过期时间并展示 |
| P0 | 库存清单 | 分类浏览、搜索、按状态筛选（在用/即将过期/已过期） |
| P0 | 淘宝链接解析 | 粘贴链接自动提取并预填产品信息 |
| P1 | 小程序内过期提醒 | 首页高亮展示即将过期产品 |
| P1 | 微信订阅消息推送 | 定时任务检查 + 消息推送 |
| P1 | 开封后保质期管理 | 记录开封日期，重新计算过期时间 |
| P1 | 自定义分类 | 用户可在预设分类基础上新增分类 |
| P2 | 产品图片上传 | 拍照或相册上传产品图片，存储到云存储 |
| P2 | 数据导出 | 导出库存清单 |
| P2 | 产品详情编辑 | 修改已录入产品的信息 |

## 技术风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 淘宝开放平台 API 申请审核周期长 | 链接解析功能延迟上线 | 先实现商品页抓取 + 标题解析作为备用方案 |
| 淘宝反爬机制导致抓取失败 | 降级方案不稳定 | 抓取失败时提示用户手动输入，同时尝试只解析标题 |
| 微信订阅消息需用户反复授权 | 推送到达率低 | 在关键操作节点（添加成功、查看过期列表）引导授权；小程序内提醒作为兜底 |
| 云函数冷启动延迟 | 链接解析响应慢 | 配置预置并发实例；前端添加加载状态 |
