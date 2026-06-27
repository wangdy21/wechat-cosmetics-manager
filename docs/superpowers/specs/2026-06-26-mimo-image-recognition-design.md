# 多模态大模型图片识别 — 设计规格

## 概述

将化妆品管理小程序的图片识别能力从「腾讯云 OCR + 手写文本解析」替换为「小米 MiMo 多模态大模型」，实现端到端的图片内容理解与结构化信息提取。

**核心变化**：删除约 500 行手写解析/签名代码，新增约 80 行 MiMo API 调用代码，净删代码。

## 动机

| 当前 OCR 方案痛点 | MiMo 方案收益 |
|-------------------|---------------|
| 依赖腾讯云密钥配置，部署门槛高 | 仅需 MiMo API Key |
| OCR 只识别文字，理解能力弱 | 多模态理解，直接看懂包装 |
| 需手写 textParser（品牌词库+正则），规则脆弱 | 模型直接输出 JSON，零规则维护 |
| 品牌词库需手动维护同步 | 模型自带知识，无需词库 |
| 客户端需回退解析 100+ 行兜底代码 | 服务端一次解析，客户端只管展示 |
| TC3-HMAC-SHA256 签名 50+ 行 | OpenAI 兼容 API，仅需 API Key 请求头 |

## 技术选型

| 维度 | 选择 |
|------|------|
| 模型 | 小米 MiMo (`mimo-v2.5-pro`)，OpenAI Chat Completions 兼容 API |
| 端点 | `https://api.xiaomimimo.com/v1/chat/completions` |
| 认证 | `api-key: $MIMO_API_KEY`（云函数环境变量） |
| 图片传输 | 先上传云存储 → 云函数下载 → Base64 传入 messages |
| 响应格式 | `response_format: { type: "json_object" }` — 强制 JSON 输出 |
| 签名 | 无需（OpenAI 兼容，仅需 API Key） |

## 架构对比

```
【当前】                                 【目标】
拍照/选图                                拍照/选图
  │                                        │
  ▼                                        ▼
上传云存储                                上传云存储
  │                                        │
  ▼                                        ▼
云函数下载                                云函数下载
  │                                        │
  ▼                                        ▼
callOCR (TC3签名)                         callMiMo (API Key)
  │                                        │
  ▼                                        ▼
textParser (品牌词库+正则)                 JSON.parse (结构化输出)
  │                                        │
  ▼                                        ▼
返回结构化数据                            返回结构化数据
  │                                        │
  ▼                                        ▼
客户端回退解析 (100+ 行)                   客户端直接展示
```

## API 契约

### 云函数响应格式

该节定义了 `productOps` 云函数 `action: 'recognizeProduct'` 的请求/响应 schema，客户端和测试均以此契约为准。

#### 请求格式

```json
{
  "action": "recognizeProduct",
  "fileID": "cloud://xxx"   // 云存储文件 ID，必填
}
```

#### 成功响应

```json
{
  "success": true,
  "data": {
    "brand":        "string | null",    // 品牌名称
    "name":         "string | null",    // 产品名称
    "specification":"string | null",    // 净含量/规格
    "category":     "string | null",    // 产品分类（枚举值或 null）
    "shelfLifeMonths": "number | null", // 保质期月数
    "productionDate":  "string | null", // YYYY-MM-DD 或 null
    "expiryDate":      "string | null", // YYYY-MM-DD 或 null
    "remainingDays":   "number | null", // 剩余天数（基于 expiryDate 计算）
    "rawResponse":     "string"         // MiMo 原始 JSON 响应用于调试
  }
}
```

- 所有商品字段 **均可为 null**——客户端自行决定默认值策略
- `rawResponse` 保存 MiMo API 返回的原始 `choices[0].message.content`（未经解析的原始文本），用于调试和问题排查
- `remainingDays` 由云函数根据 `expiryDate` 计算，与当前行为一致

#### 失败响应

```json
{
  "success": false,
  "error": "string"  // 面向用户的错误描述
}
```

**标准错误码（按来源分层）：**

*输入层错误：*
| error 消息 | 触发条件 | 客户端行为 |
|------------|---------|-----------|
| `"缺少图片文件"` | event.fileID 为空 | 提示用户重试 |
| `"图片下载失败"` | cloud.downloadFile 异常 | 提示检查网络 |

*配置层错误：*
| error 消息 | 触发条件 | 客户端行为 |
|------------|---------|-----------|
| `"MiMo 未配置"` | MIMO_API_KEY 环境变量缺失 | 提示联系开发者 |

*MiMo 提供商错误：*
| error 消息 | HTTP 状态码 | 触发条件 | 客户端行为 |
|------------|------------|---------|-----------|
| `"识别服务暂时不可用"` | 401 | API Key 无效 | 提示联系开发者 |
| `"识别服务繁忙，请稍后重试"` | 429 | 速率限制 | 提示稍后重试 |
| `"识别服务暂时不可用"` | 5xx | MiMo 服务端错误 | 提示稍后重试 |
| `"识别超时，请检查网络"` | — | 请求 30s 超时 | 提示重试 |

*解析层错误：*
| error 消息 | 触发条件 | 客户端行为 |
|------------|---------|-----------|
| `"未能识别，请手动录入"` | MiMo 返回空 content | 引导手动录入 |
| `"识别结果异常，请手动录入"` | JSON 解析失败 | 引导手动录入 |

#### 字段类型校验规则

- `shelfLifeMonths`: 如果 MiMo 返回非数字值（含字符串数字），强制 `Number()` 转换；NaN 时置 `null`
- `expiryDate` / `productionDate`: 必须匹配 `/^\d{4}-\d{2}-\d{2}$/`；不匹配时置 `null`
- `category`: 不做枚举约束（MiMo 可能返回不在列表内的分类，客户端可按需处理）
- 所有字段均做 trim 和空字符串 → null 标准化

## 文件变更清单

### 删除

| 文件 | 原因 |
|------|------|
| `cloudfunctions/productOps/ocr.js` | 腾讯云 OCR 集成，完全替换 |
| `cloudfunctions/productOps/textParser.js` | 手写解析规则，不再需要 |
| `tests/textParser.test.js` | 对应模块已删除 |

### 新建

| 文件 | 说明 |
|------|------|
| `cloudfunctions/productOps/mimo.js` | MiMo API 调用模块（~80 行） |
| `tests/mimo.test.js` | MiMo 模块单元测试（Mock HTTPS） |

### 修改

| 文件 | 改动 |
|------|------|
| `cloudfunctions/productOps/index.js` | `handleRecognizeProduct`: `callOCR` → `callMiMo`，删除 `extractProductInfo` 导入，调整 JSON 解析逻辑 |
| `miniprogram/utils/imageRecognizer.js` | 更新 JSDoc，`rawText` → `rawResponse`，返回结构对齐新字段 |
| `miniprogram/pages/add/add.js` | 删除客户端回退解析（`parseFromRawText`、`PRODUCT_NAME_INDICATORS`、`CLIENT_BRAND_LIST`、`looksLikeProductName`），简化 `onChooseImage` 字段映射 |
| `miniprogram/utils/constants.js` | 添加注释注明 `BRAND_LIST`/`matchBrand`/`extractSpecification` 仅用于链接解析 |
| `tests/productOps.test.js` | 更新 `recognizeProduct` 相关测试用例 |

## MiMo 调用模块设计

### `cloudfunctions/productOps/mimo.js`

```javascript
/**
 * 小米 MiMo 多模态大模型调用模块
 * 使用 OpenAI 兼容 API 调用 MiMo 进行图片内容识别
 *
 * 部署前需在云函数环境变量中配置：
 *   MIMO_API_KEY - 小米 MiMo API Key
 *
 * 获取方式：https://platform.xiaomimimo.com/
 */

const https = require('https');

const ENDPOINT = 'https://api.xiaomimimo.com/v1/chat/completions';
const MODEL = 'mimo-v2.5-pro';

/**
 * 调用 MiMo 识别化妆品图片
 * @param {Buffer} imageBuffer 图片二进制数据
 * @returns {Promise<{info: Object, rawContent: string}>} 结构化商品信息 + 原始响应
 */
function callMiMo(imageBuffer) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.MIMO_API_KEY;
    if (!apiKey) {
      reject(new Error('MiMo 未配置'));
      return;
    }

    const payload = JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: USER_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      top_p: 1.0,
      max_completion_tokens: 1024,
      thinking: { type: 'disabled' },
    });

    const url = new URL(ENDPOINT);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      timeout: 30000,  // 30 秒超时
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode === 401) {
          reject(new Error('识别服务暂时不可用'));
          return;
        }
        if (res.statusCode === 429) {
          reject(new Error('识别服务繁忙，请稍后重试'));
          return;
        }
        if (res.statusCode >= 500) {
          reject(new Error('识别服务暂时不可用'));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`MiMo HTTP ${res.statusCode}: ${body.substring(0, 200)}`));
          return;
        }
        try {
          const json = JSON.parse(body);
          const content = json.choices?.[0]?.message?.content;
          if (!content) {
            reject(new Error('MiMo 返回内容为空'));
            return;
          }
          // 去除可能的 Markdown 代码块包裹
          const cleanContent = content
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          const parsed = JSON.parse(cleanContent);
          resolve({ info: parsed, rawContent: content });
        } catch (e) {
          reject(new Error('MiMo 响应解析失败: ' + e.message));
        }
      });
    });

    req.on('error', (e) => reject(new Error('MiMo 请求失败: ' + e.message)));
    req.write(payload);
    req.end();
  });
}

const SYSTEM_PROMPT = `你是一个化妆品信息识别助手。用户会提供化妆品包装图片，请从图片中识别并提取以下信息。只返回 JSON，不要添加任何解释。如果某项无法从图片中识别，对应字段设为 null。`;

const USER_PROMPT = `请从这张化妆品包装图片中提取以下信息，以 JSON 格式返回：
- brand: 品牌名称（如"兰蔻"、"雅诗兰黛"）
- name: 产品名称（如"小黑瓶精华肌底液"）
- specification: 净含量/规格（如"30ml"、"50g"）
- category: 产品分类，从以下列表中选择最匹配的一项：护肤、彩妆、美发、身体护理、香水、防晒、精华、面霜、化妆水、面膜、清洁、眼妆、底妆、口红、定妆、腮红修容、美甲、护发、身体护理、工具
- shelfLifeMonths: 保质期（以月为单位，如36；若包装标注"3年"则返回36；若未标注则为null）
- expiryDate: 限期使用日期/到期日期（格式 YYYY-MM-DD，若未标注则为null）
- productionDate: 生产日期（格式 YYYY-MM-DD），如果包装没有直接标注生产日期，但标注了到期日期和保质期，请根据到期日期减去保质期推算生产日期；若无法推算则为null`;

module.exports = { callMiMo };
```

### Prompt 设计要点

- **System prompt** 明确角色和输出约束（纯 JSON，无解释）
- **User prompt** 列出所有字段及说明，包含示例和格式要求
- **category 字段** 给定枚举列表，模型从列表中选择（而非自由发挥）
- **shelfLifeMonths** 明确"年→月"换算规则（如 3 年 → 36）
- **productionDate** 增加了推理逻辑说明（到期日期 - 保质期 ⇒ 生产日期），利用模型的计算能力
- **temperature: 0.1** 低随机性保证提取精度
- **thinking: disabled** 不需要思维链，节省 token 和延迟

## 云函数入口改造

### `handleRecognizeProduct` 改动

```javascript
// 当前（约 40 行）:
async function handleRecognizeProduct(event, openid) {
  // 1. 下载图片
  // 2. lines = await callOCR(imageBuffer)
  // 3. info = extractProductInfo(lines)     ← 删除
  // 4. 根据 info.expiryDate 计算 remainingDays
  // 5. 返回 { brand, name, ... rawText: lines.join('\n') }
}

// 改造后（约 35 行）:
async function handleRecognizeProduct(event, openid) {
  // 1. 下载图片 (不变)
  // 2. { info, rawContent } = await callMiMo(imageBuffer)   ← 返回解析后对象 + 原始 content
  // 3. 校验字段类型（shelfLifeMonths 转数字，日期校验格式）
  // 4. 根据 info.expiryDate 计算 remainingDays
  // 5. 返回 { brand, name, ... rawResponse: rawContent }
  //
  // catch (err) 时，将内部错误映射为合约字符串：
  //   "MiMo 返回内容为空"    → "未能识别，请手动录入"
  //   "MiMo 响应解析失败: *"  → "识别结果异常，请手动录入"
  //   "MiMo 请求失败: *"     → "识别服务暂时不可用"
  //   "MiMo HTTP 4xx: *"    → "识别服务暂时不可用"
}
```

### 容错处理

```javascript
// MiMo JSON 解析容错
function parseMiMoContent(content) {
  // 1. 去除 Markdown 代码块包裹
  let cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // 2. JSON.parse
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error('MiMo 返回内容不是有效的 JSON，请重试');
  }

  // 3. 字段类型标准化
  if (parsed.shelfLifeMonths !== null && parsed.shelfLifeMonths !== undefined) {
    parsed.shelfLifeMonths = Number(parsed.shelfLifeMonths);
    if (isNaN(parsed.shelfLifeMonths)) parsed.shelfLifeMonths = null;
  }

  // 4. 日期格式校验（YYYY-MM-DD）
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (parsed.expiryDate && !dateRegex.test(parsed.expiryDate)) parsed.expiryDate = null;
  if (parsed.productionDate && !dateRegex.test(parsed.productionDate)) parsed.productionDate = null;

  return parsed;
}
```

## 客户端改造

### `miniprogram/pages/add/add.js`

**删除的代码块**（共约 120 行）：
1. `PRODUCT_NAME_INDICATORS` 数组定义
2. `CLIENT_BRAND_LIST` 数组定义
3. `looksLikeProductName()` 函数
4. `parseFromRawText()` 函数及其完整实现
5. `onChooseImage` 中的 `parseFromRawText(data.rawText)` 回退调用
6. 字段的 `|| fallback.xxx` 默认值逻辑

**保留的降级逻辑**（云函数不可达时）：
- 名称未识别 → 默认 "待确认产品名称"
- 生产日期未识别 → 默认今天
- 保质期未识别 → 默认 36 个月

### `miniprogram/utils/imageRecognizer.js`

- JSDoc 中 `rawText` 字段改为 `rawResponse`（保存 MiMo 原始 JSON 响应用于调试）
- 返回结构对齐：移除 `rawText`，新增 `rawResponse`

### `miniprogram/utils/constants.js`

- `BRAND_LIST`、`matchBrand`、`extractSpecification` 保留不变
- 添加注释：`// 注意：以下品牌识别工具仅用于淘宝链接解析（parseLink），图片识别已改用 MiMo 多模态模型`

## 环境变量

云函数 `productOps` 需配置：

| 变量名 | 说明 | 备注 |
|--------|------|------|
| `MIMO_API_KEY` | 小米 MiMo API Key | 新增，从 https://platform.xiaomimimo.com/ 获取 |
| `OCR_SECRET_ID` | 腾讯云 SecretId | **删除** |
| `OCR_SECRET_KEY` | 腾讯云 SecretKey | **删除** |

## 运维与可观测性

### 日志

云函数 `console.log` 记录关键调用节点，用于错误追踪：

- 每次 MiMo 调用开始打时间戳
- 请求成功/失败均打印响应状态码和 token 用量
- JSON 解析失败时打印原始 MiMo content（前 500 字符）
- 环境变量缺失时打印明确提示

### 故障处理矩阵

| 故障类型 | 频率阈值 | 处理策略 |
|----------|---------|---------|
| MiMo HTTP 4xx（认证/参数） | 持续 | 报警 → 检查 API Key / 参数格式 |
| MiMo HTTP 5xx（服务端错误） | 单次 | 客户端提示重试 |
| MiMo HTTP 5xx（服务端错误） | 连续 3 次 | 提示「识别服务暂时不可用，请稍后重试」 |
| MiMo 返回空 content | 连续 5 次 | 提示「当前图片无法识别，请拍摄更清晰的包装」 |
| MiMo 请求超时（30s） | 单次 | 客户端提示「识别超时，请检查网络后重试」 |
| JSON 解析失败 | 持续 | 检查 MiMo 响应格式是否变更；考虑调整 prompt |

### 限流与重试策略

| 参数 | 值 | 说明 |
|------|----|------|
| 请求超时 | 30 秒 | Node.js `https.request` timeout |
| 重试次数 | 2 次（共 3 次尝试） | 仅对 5xx 和网络错误重试 |
| 重试退避 | 指数退避：1s → 2s | 避免加重服务端压力 |
| 熔断阈值 | 连续 5 次失败 | 之后 60 秒内直接返回错误，不发送请求 |
| 熔断恢复 | 60 秒冷却后 1 次探测 | 探测成功则关闭熔断；失败则重新计时 |

**不重试的情况**：HTTP 4xx（认证/参数错误，重试无意义）、JSON 解析失败（非瞬时错误）

**当前使用场景**为单用户逐次调用，QPS < 1，不在 MiMo 限流风险范围内。如后续增加批量识别，需评估是否需要请求队列。

## 实施与迁移计划

### 部署顺序（严格按此顺序执行）

```
第 1 步: 添加 MIMO_API_KEY 环境变量（与现有 OCR 变量并存，互不影响）
第 2 步: 部署新版云函数 productOps
第 3 步: 部署新版小程序前端
第 4 步: 验证确认 → 删除 OCR_SECRET_ID / OCR_SECRET_KEY
```

- **第 2、3 步必须同时上线**：新版前端依赖新版云函数的响应格式（`rawResponse` 替代 `rawText`）
- 第 4 步为清理步骤，可在验证通过后的任意时间执行

### 回滚方案

触发以下任一条件时执行回滚：

1. 新版云函数部署后，`recognizeProduct` 错误率 > 10%（对比旧版基线）
2. MiMo API 持续返回 5xx 超过 30 分钟
3. 用户反馈识别准确率显著下降（如品牌名大量识别错误）

**回滚操作清单（严格按顺序）：**

| 步骤 | 操作 | 工具/路径 |
|------|------|----------|
| 1 | 云函数回滚至旧版本 | 腾讯云控制台 → 云函数 → productOps → 版本管理 → 选择旧版本 → 回滚 |
| 2 | 恢复 OCR 环境变量（如已删除） | 腾讯云控制台 → 云函数 → productOps → 环境变量 → 添加 `OCR_SECRET_ID`、`OCR_SECRET_KEY` |
| 3 | 小程序发布回滚版本 | 微信开发者工具 → 上传 → 版本管理 → 回滚至旧版本 |
| 4 | 验证 OCR 功能恢复 | 拍摄一张化妆品包装，确认走 OCR 流程且识别正常 |
| 5 | 暂时保留 MIMO_API_KEY 变量 | 不删除，便于后续重新尝试迁移 |

**回滚后分析**：检查 MiMo 调用日志中的错误模式，确定是配置问题、API 稳定性问题还是模型效果问题，修复后重新尝试迁移。

### 验收标准

| 场景 | 预期行为 |
|------|---------|
| 拍摄清晰化妆品包装 | 成功提取 ≥ 3 个字段（品牌/名称/规格至少命中一个） |
| 拍摄模糊/非化妆品图片 | 返回 `success: false`，error 信息友好 |
| MiMo API Key 未配置 | 返回 `success: false`，error 明确提示配置问题 |
| 识别结果 JSON 被 Markdown 包裹 | 正确 strip 后解析成功 |
| shelfLifeMonths 返回字符串 "36" | 正确转为数字 36 |
| expiryDate 格式异常 | 字段置 null，其他字段正常返回 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| MiMo 服务不稳定/超时 | 云函数超时设置 30s；失败时前端显示「识别失败，请手动录入」 |
| MiMo JSON 输出格式偏差 | 多层容错：strip Markdown 包裹 → JSON.parse → 字段类型校验 |
| MiMo 识别准确度不如预期 | 选择 `mimo-v2.5-pro` 旗舰模型；temperature 设为 0.1 |
| API 成本 | 单次约含 1 张图 + prompt (~500 tokens) + 输出 (~200 tokens)，预估 < 0.01 元/次 |
| 图片过大 | 云存储上传限制 20MB；云函数下载后再转 Base64，单张控制在 5MB 以内 |

## 测试策略

### 单元测试（`tests/mimo.test.js`）

- Mock `https.request`，验证请求体格式（model、messages、response_format、temperature、thinking）
- `callMiMo` 返回 `{ info, rawContent }` 格式校验
- 正常响应 JSON 解析 + rawContent 保存原始内容
- Markdown 代码块包裹的 JSON 解析
- 字段类型校验（shelfLifeMonths NaN → null，日期格式非法 → null）
- HTTP 错误码处理（401 → API Key 无效，429 → 速率限制，500 → 服务端错误）
- 重试逻辑：5xx 触发重试（1s + 2s 退避），4xx 不重试
- 熔断机制：连续 5 次失败后直接返回错误，60s 冷却后发送探测请求
- API Key 未配置错误
- 空 content 错误

### 集成测试

- `tests/productOps.test.js` 更新 `recognizeProduct` 用例
- 删除 `tests/textParser.test.js`

### 手动验证

1. 拍一张化妆品包装照片，确认识别结果正确
2. 拍一张模糊照片，确认降级提示友好
3. 确认无 OCR 相关环境变量后云函数仍正常运行（使用 MiMo）

## 实施步骤

1. 新建 `mimo.js` + `mimo.test.js`
2. 修改 `index.js` 中 `handleRecognizeProduct`
3. 删除 `ocr.js`、`textParser.js`、`textParser.test.js`
4. 修改 `add.js`（删除客户端回退解析）
5. 修改 `imageRecognizer.js`（字段名调整）
6. 修改 `constants.js`（添加注释）
7. 更新 `productOps.test.js`
8. 配置云函数环境变量 `MIMO_API_KEY`，删除 `OCR_SECRET_ID`/`OCR_SECRET_KEY`
9. 云函数部署 + 端到端测试
10. 提交代码

---

*文档版本: 1.0 | 日期: 2026-06-26 | 作者: AI Assistant*
