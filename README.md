# CosmeticBox - 微信化妆品管理小程序

一款面向个人消费者的微信小程序，帮助管理化妆品库存、追踪保质期，并在产品即将过期时主动提醒。支持手动录入、拍照 OCR 识别和淘宝链接解析三种添加方式。

## 功能特性

- **OCR 拍照识别** — 拍摄化妆品包装，自动识别品牌、产品名称、规格、保质期和分类
- **产品管理** — 完整的增删改查操作，支持手动录入和编辑
- **分类管理** — 内置预设分类（精华、面霜、底妆等 15 种），支持用户自定义扩展
- **保质期提醒** — 智能计算过期日期，首页仪表盘实时展示已过期/即将过期产品
- **保质期进度可视化** — 进度条直观展示产品已用时长的占比
- **库存清单** — 支持分类筛选、关键词搜索、分页加载
- **定时推送** — 每天 08:00 自动检查产品状态，通过微信订阅消息提醒用户
- **用户设置** — 自定义提醒提前天数、推送开关等个性化配置

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | 微信小程序原生开发 |
| 后端 | 微信云开发（云函数 + 云数据库） |
| 云数据库 | MongoDB（微信云开发内置） |
| 标记语言 | WXML / WXSS |
| 运行环境 | Node.js（云函数）、JavaScript ES6（前端） |
| 图像识别 | 腾讯云 OCR API（GeneralAccurateOCR） |
| 测试框架 | Jest（170 个单元测试） |
| 设计系统 | 珊瑚粉主色 + 薰衣草紫辅色，Monument Valley 极简几何风格 |

## 项目结构

```
wechat-cosmetics-manager/
├── miniprogram/                   # 小程序前端
│   ├── app.js                     # 小程序入口，云开发初始化
│   ├── app.json                   # 页面路由、TabBar、窗口样式配置
│   ├── app.wxss                   # 全局样式（设计系统 Token）
│   ├── pages/                     # 页面
│   │   ├── home/                  # 首页仪表盘
│   │   ├── add/                   # 添加产品（拍照/手动双模式）
│   │   ├── inventory/             # 库存清单
│   │   ├── detail/                # 产品详情
│   │   ├── edit/                  # 编辑产品
│   │   ├── category/              # 分类管理
│   │   └── profile/               # 个人中心/设置
│   ├── components/
│   │   └── product-card/          # 产品卡片组件
│   ├── utils/                     # 工具函数
│   │   ├── constants.js           # 常量、品牌词库、状态枚举
│   │   ├── date.js                # 日期计算（过期时间、剩余天数）
│   │   ├── display.js             # 展示逻辑（进度条、状态标签）
│   │   ├── imageRecognizer.js     # 图片选择、上传、OCR 调用
│   │   └── parser.js              # 链接类型识别、URL 提取
│   └── images/                    # 图标资源
├── cloudfunctions/                # 云函数
│   ├── productOps/                # 核心业务（产品CRUD + 分类管理 + OCR + 设置）
│   │   ├── index.js               # 入口：action 参数分发
│   │   ├── logic.js               # 纯业务逻辑（校验、状态计算）
│   │   ├── ocr.js                 # 腾讯云 OCR API 集成（TC3-HMAC-SHA256 签名）
│   │   ├── textParser.js          # OCR 文本解析（品牌/名称/分类/日期提取）
│   │   ├── date.js                # 日期计算
│   │   ├── package.json           # 云函数依赖
│   │   └── config.json            # 权限配置
│   ├── parseLink/                 # 淘宝链接解析
│   │   ├── index.js               # 短链解析、页面抓取、标题提取
│   │   ├── logic.js               # 商品ID提取、标题解析、分类推断
│   │   ├── constants.js           # 品牌词库、分类关键词
│   │   └── package.json
│   └── reminder/                  # 定时提醒
│       ├── index.js               # 状态批量更新 + 订阅消息推送
│       ├── logic.js               # 产品分类逻辑
│       ├── date.js                # 日期计算
│       ├── config.json            # 定时触发器（每天 08:00）
│       └── package.json
├── design-system/                 # 设计系统文档
│   ├── MASTER.md                  # 全局设计规范（色彩、字体、间距、动画）
│   └── pages/                     # 各页面设计覆盖
│       ├── home.md
│       ├── add.md
│       ├── inventory.md
│       ├── detail.md
│       ├── category.md
│       └── profile.md
├── docs/                          # 项目文档
│   └── superpowers/specs/         # 设计规格
│       └── 2026-03-31-cosmetics-manager-design.md
├── tests/                         # 单元测试（170 个用例，全部通过）
│   ├── date.test.js               # 日期计算测试 (18)
│   ├── constants.test.js          # 常量/品牌匹配测试 (14)
│   ├── productOps.test.js         # 业务逻辑测试 (30)
│   ├── parser.test.js             # 链接解析测试 (33)
│   ├── display.test.js            # 展示逻辑测试 (21)
│   ├── parseLink.test.js          # 淘宝解析测试 (19)
│   ├── reminder.test.js           # 提醒逻辑测试 (8)
│   └── textParser.test.js         # OCR文本解析测试 (27)
├── project.config.json            # 微信开发者工具项目配置
├── project.private.config.json    # 私有配置（已在 .gitignore 中排除）
├── package.json                   # 项目依赖（Jest 测试框架）
├── task_plan.md                   # 项目任务计划
├── progress.md                    # 开发进度日志
├── findings.md                    # 技术调研与决策记录
└── .gitignore                     # Git 忽略规则
```

## 核心功能详解

### 1. OCR 拍照识别录入

通过微信小程序 `wx.chooseMedia` API 拍照或选择相册图片，上传至云存储后调用 `productOps` 云函数的 `recognizeProduct` action。云函数内部：

1. 从云存储下载图片二进制数据
2. 使用 TC3-HMAC-SHA256 签名调用腾讯云 **GeneralAccurateOCR** API 进行文字识别
3. 通过 `textParser.js` 解析识别的文本行，提取：
   - **品牌** — 品牌词库匹配（>100 个品牌，优先最长匹配）
   - **产品名称** — key-value 对提取 + 回退识别
   - **规格** — 净含量提取（支持 ml/g/片/支/对）
   - **分类** — 关键词分类推断（15 种类别）
   - **保质期** — 支持「3年」「36个月」等格式解析
   - **限期使用日期** — 支持日期范围和单个日期格式
   - **生产日期** — 根据到期日期和保质期自动反推

### 2. 产品管理

通过 `productOps` 云函数统一入口，支持以下操作（通过 `action` 参数分发）：

| Action | 功能 | 说明 |
|--------|------|------|
| `add` | 添加产品 | 校验输入 → 计算过期日期 → 解析初始状态 → 写入数据库 |
| `list` | 查询列表 | 支持分类/状态/关键词筛选 + 分页，分批拉取突破单次 100 条限制 |
| `get` | 查询详情 | 单产品查询 + 所有权校验 |
| `update` | 更新产品 | 部分字段更新，涉及日期字段时自动重算过期时间和状态 |
| `updateStatus` | 标记状态 | 手动标记为 `used_up`（用完）或 `discarded`（丢弃） |
| `delete` | 删除产品 | 删除前校验所有权 |

**产品数据模型**包含字段：品牌(brand)、名称(name)、分类(category)、规格(specification)、图片(imageUrl)、来源(source)、生产日期(productionDate)、保质期月数(shelfLifeMonths)、过期日期(expirationDate)、状态(status)、开封日期(openedDate)、开封后保质期(openedShelfLifeMonths) 等。

**保质期计算规则**：`expirationDate = min(生产日期 + 未开封月数, 开封日期 + 开封后月数)`，由服务端计算保证一致性。

**状态系统**：

| 状态 | 含义 | 判定条件 |
|------|------|----------|
| `in_use` | 正常使用中 | 剩余天数 > 提醒提前天数 |
| `expiring_soon` | 即将过期 | 0 < 剩余天数 <= 提醒提前天数 |
| `expired` | 已过期 | 剩余天数 <= 0 |
| `used_up` | 已用完 | 用户手动标记 |
| `discarded` | 已丢弃 | 用户手动标记 |

### 3. 分类管理

分类存储于 `categories` 集合，支持：
- **系统预设分类**（`_openid: "system"`）：精华、面霜、底妆、口红、防晒、面膜等 15 种
- **用户自定义分类**：支持增删操作，按 `sortOrder` 排序
- 重名检测（同用户下分类名不可重复）

### 4. 保质期提醒系统

云端定时触发器 (`reminder` 云函数)：
- **触发时间**：每天 08:00（通过 `config.json` 中 cron 表达式配置）
- **执行流程**：
  1. 查询所有活跃产品（`in_use` / `expiring_soon`）
  2. 按用户提醒设置分类产品
  3. 批量更新 `expired` 和 `expiring_soon` 状态
  4. 对已授权推送的用户发送微信订阅消息
- 用户可在「个人中心」自定义提醒提前天数（默认 30 天）

### 5. 首页仪表盘

- 渐变背景 + 几何装饰元素（圆形/矩形/三角形）
- 统计卡片：在用产品数、需注意产品数、安全率
- 即将过期警告列表（显示剩余天数）
- 最近添加产品列表
- 基于 `expirationDate` 实时计算展示状态，避免 cron 延迟窗口

## 设计系统

CosmeticBox 采用独特的设计语言，融合三个核心理念：

- **极简几何**（Monument Valley 风格）— 纯净有序，圆形/三角/方形装饰
- **激励反馈**（Duolingo 风格）— 进度条、统计数字、游戏化元素
- **清新柔和** — 暖调用色，年轻不幼稚，精致不严肃

| 类别 | 值 |
|------|-----|
| 主色 | 珊瑚粉 `#FF6B8A` |
| 辅色 | 薰衣草紫 `#8B5CF6` |
| 页面背景 | 暖白 `#FFFBF5` |
| 卡片背景 | 纯白 `#FFFFFF` |
| 主文字色 | 暖黑 `#1F1D2B` |
| 卡片圆角 | 20px |
| 进度条高度 | 6px |
| 图标风格 | SVG Outline，无 Emoji |

详细设计规范见 `design-system/MASTER.md`。

## 快速开始

### 环境准备

1. **安装微信开发者工具**：从[官网](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)下载安装
2. **注册微信小程序**：在[微信公众平台](https://mp.weixin.qq.com/)注册并获得 AppID（测试号也可）
3. **开通云开发**：在微信开发者工具中创建云开发环境
4. **安装 Node.js**：推荐 Node.js 18+（用于运行测试和云函数本地调试）

### 克隆项目

```bash
git clone <your-repo-url>
cd wechat-cosmetics-manager
```

### 安装测试依赖

```bash
npm install
```

### 导入项目

1. 打开微信开发者工具
2. 选择「导入项目」，目录选择本项目根目录
3. 在 `project.config.json` 中填入你的 AppID
4. 在 `miniprogram/app.js` 中将 `ENV_ID` 替换为你的云环境 ID

### 部署云函数

在微信开发者工具中，右键点击 `cloudfunctions/` 目录下的每个云函数文件夹（`productOps`、`parseLink`、`reminder`），选择「上传并部署：云端安装依赖」。

### 配置 OCR 服务（可选，拍照识别功能需要）

如需使用拍照识别功能，需要在腾讯云开通 OCR 服务：

1. 登录[腾讯云控制台](https://console.cloud.tencent.com/)
2. 开通[文字识别 OCR](https://console.cloud.tencent.com/ocr) 服务
3. 在[访问管理](https://console.cloud.tencent.com/cam)中创建 API 密钥（SecretId / SecretKey）
4. 为子账号关联 `QcloudOCRFullAccess` 策略
5. 在微信云开发控制台 → 云函数 → `productOps` → 环境变量中添加：
   - `OCR_SECRET_ID`：你的 SecretId
   - `OCR_SECRET_KEY`：你的 SecretKey

### 运行测试

```bash
npm test
```

预期输出：**170 个测试用例全部通过**。

## 部署说明

### 部署到微信开发者工具

1. 在微信开发者工具中点击「预览」或「真机调试」进行本地调试
2. 确认云函数已全部上传部署
3. 在云开发控制台创建云数据库集合：
   - `products` — 产品数据
   - `categories` — 分类数据
   - `reminder_settings` — 用户提醒设置

### 发布上线

1. 在微信开发者工具中点击「上传」
2. 登录[微信公众平台](https://mp.weixin.qq.com/)，进入「版本管理」
3. 选择上传的版本，提交审核
4. 审核通过后发布上线

### 定时提醒触发器

`reminder` 云函数的 `config.json` 中已配置每天 08:00 执行的定时触发器。首次部署后自动生效。可在云开发控制台 → 云函数 → `reminder` → 触发器管理中查看和调整。

## 测试覆盖

项目采用 **TDD（测试驱动开发）** 方式，使用 Jest 测试框架：

| 测试套件 | 用例数 | 覆盖内容 |
|----------|--------|----------|
| `date.test.js` | 18 | 日期加减、过期计算、月末溢出修正 |
| `constants.test.js` | 14 | 品牌匹配（中文/英文/大小写）、规格提取 |
| `productOps.test.js` | 30 | 输入校验、产品记录构建、状态计算、更新重算 |
| `parser.test.js` | 33 | 链接类型识别、URL 提取、淘口令解析 |
| `display.test.js` | 21 | 进度百分比、剩余天数文字、状态标签生成 |
| `parseLink.test.js` | 19 | 商品 ID 提取、标题解析、分类推断 |
| `reminder.test.js` | 8 | 产品分类、到期/即将到期判定 |
| `textParser.test.js` | 27 | OCR 文本解析（品牌/名称/规格/日期提取） |

## 配置文件说明

| 文件 | 说明 |
|------|------|
| `project.config.json` | 小程序项目配置（AppID、云开发根目录、编译设置等） |
| `project.private.config.json` | 私有配置，包含个人开发设置（已加入 .gitignore） |
| `package.json` | 项目 Node.js 依赖（仅含 Jest 测试框架） |
| `miniprogram/app.json` | 页面路由、TabBar（4 个标签页）、窗口样式 |
| `miniprogram/app.js` | 小程序入口，云开发初始化 |
| `miniprogram/app.wxss` | 全局样式变量（设计系统 Token → CSS 变量） |
| `cloudfunctions/*/config.json` | 云函数权限配置和定时触发器配置 |
| `cloudfunctions/*/package.json` | 云函数依赖声明（wx-server-sdk 等） |

## 技术决策与经验

详见项目中的技术文档：

- [task_plan.md](task_plan.md) — 完整的 9 阶段开发任务计划
- [findings.md](findings.md) — 技术调研、架构决策记录
- [progress.md](progress.md) — 开发进度与错误日志
- [design-system/MASTER.md](design-system/MASTER.md) — 完整的设计规范

关键决策：

- **产品过期日期由服务端计算**，避免客户端版本差异导致数据不一致
- **前端 onShow 基于 expirationDate 实时计算展示状态**，避免依赖 cron 更新造成最多 24 小时的延迟
- **云数据库单次查询上限为 100 条**，列表查询通过分批拉取突破限制
- **OCR 环境变量不使用 `TENCENTCLOUD_` 前缀**，该前缀为 SCF 平台保留字段
- **产品来源字段 `source`** 记录录入方式（`image` OCR 识别 / `link` 链接导入 / `manual` 手动录入），创建后不可修改

## License

ISC
