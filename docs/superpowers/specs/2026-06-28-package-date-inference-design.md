# 包装日期智能推断 — 设计规格

## 概述

化妆品包装通常印刷"有效期至"而非"生产日期"。当前 MiMo 识别分别提取 `productionDate` 和 `expiryDate` 两个字段，但多模态模型难以区分中文标签的语义含义，常常两个字段都返回 null。本设计将 MiMo 的任务简化为"提取包装上任意日期字符串"，由云函数根据"与今天比较"的规则自动推断该日期的含义。

## 动机

| 当前问题 | 改进后 |
|---------|--------|
| MiMo 需理解"生产日期"vs"有效期至"的中文语义，识别率低 | MiMo 只需 OCR 日期字符串，不管含义 |
| 两个日期字段经常同时为 null | 合并为单一 `packageDate` 字段，提取成功率更高 |
| 前端需要 `productionDate \|\| today` 的复杂兜底 | 云函数统一推断，前端直接用 |
| 没有利用"未来日期=有效期"的行业常识 | 根据时间比较自动判断 |

## 设计

### 架构

```
拍照/选图
  │
  ▼
MiMo Vision API
  │  只提取：packageDate (包装上的任意日期字符串)
  │  保留：   shelfLifeMonths (保质期文字，如"3年")
  ▼
inferDates() [新增] —— 云函数端日期推断
  │  packageDate > 今天 → 有效期至 → 反推生产日期
  │  packageDate ≤ 今天 → 生产日期
  │  shelfLifeMonths 默认 36
  ▼
返回 { productionDate, shelfLifeMonths, packageDate }
  │
  ▼
前端 add.js —— 直接填入表单
```

### 修改文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `cloudfunctions/productOps/mimo.js` | 修改 | USER_PROMPT: `expiryDate`+`productionDate` → `packageDate` |
| `cloudfunctions/productOps/index.js` | 修改 | 新增 `inferDates()`；修改 `normalizeMiMoInfo()`；修改 `handleRecognizeProduct()` 返回字段 |
| `miniprogram/pages/add/add.js` | 修改 | 简化识别结果填充逻辑，移除 `productionDate \|\| today` 兜底 |
| `tests/mimo.test.js` | 修改 | 更新 prompt 格式断言 |
| `tests/productOps.test.js` | 修改 | 新增 `inferDates` 测试用例 |

### 不改动的文件

- `add.wxml` / `edit.js` / `detail.*` — 表单结构不变
- `date.js` / `display.js` — 核心计算逻辑不变
- `logic.js` — `buildProductRecord` 不变

---

## 详细规格

### 1. MiMo Prompt 变更（`mimo.js`）

**USER_PROMPT** 中替换日期字段：

```
旧：
- expiryDate: 限期使用日期/到期日期（格式 YYYY-MM-DD，若未标注则为null）
- productionDate: 生产日期（格式 YYYY-MM-DD），如果包装没有直接标注生产日期，
  但标注了到期日期和保质期，请根据到期日期减去保质期推算生产日期；若无法推算则为null

新：
- packageDate: 包装上印刷的日期（如"EXP 2027-06"、"限期使用日期: 2026/03/15"、
  "20290426"、"MFG 2025-01"等任何日期格式），提取为 YYYY-MM-DD 格式；若未找到
  任何日期则为 null。不要判断该日期是生产日期还是到期日期，只需提取日期本身。
```

`shelfLifeMonths` 字段保持不变。

### 2. 日期推断函数（`index.js` 新增）

```javascript
const DEFAULT_SHELF_LIFE_MONTHS = 36;

/**
 * 根据包装日期和保质期，推断生产日期
 *
 * 规则：
 * - packageDate > 今天 → 当作"有效期至"，productionDate = packageDate - shelfLifeMonths
 * - packageDate ≤ 今天 → 当作"生产日期"，productionDate = packageDate
 * - packageDate 为 null → 返回 null，前端自行兜底
 *
 * 边界：
 * - 反推出的 productionDate 若在未来（不合理），降级为 packageDate 本身
 * - 反推出的 productionDate 若比今天早超过 10 年，仍保留（用户可手动修正）
 */
function inferDates(packageDate, shelfLifeMonths, today) {
  const months = (shelfLifeMonths && shelfLifeMonths > 0) ? shelfLifeMonths : DEFAULT_SHELF_LIFE_MONTHS;

  if (!packageDate) {
    return { productionDate: null, shelfLifeMonths: months };
  }

  const pkgTime = new Date(packageDate + 'T00:00:00').getTime();
  const nowTime = new Date(today).getTime();

  if (pkgTime > nowTime) {
    // 未来日期 → 有效期至 → 反推生产日期
    const prodDate = subtractMonths(packageDate, months);
    const prodTime = new Date(prodDate + 'T00:00:00').getTime();
    if (prodTime > nowTime) {
      // 反推后仍在未来（不合理），降级为 packageDate 即生产日期
      return { productionDate: packageDate, shelfLifeMonths: months };
    }
    return { productionDate: prodDate, shelfLifeMonths: months };
  }

  // 过去日期 → 生产日期
  return { productionDate: packageDate, shelfLifeMonths: months };
}
```

`subtractMonths` 复用 `date.js` 中 `addMonths` 的逻辑（传入负月数）。

### 3. `normalizeMiMoInfo` 字段变更

```javascript
// 旧：校验 expiryDate, productionDate
// 新：校验 packageDate，移除 expiryDate/productionDate 校验
function normalizeMiMoInfo(info) {
  // shelfLifeMonths 字符串→数字（不变）
  // ...

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (info.packageDate && !dateRegex.test(info.packageDate)) info.packageDate = null;

  // 空字符串 → null（brand/name/specification/category + packageDate）
  // ...

  return info;
}
```

### 4. `handleRecognizeProduct` 响应字段变更

```javascript
// 旧响应
data: {
  brand, name, specification, category,
  shelfLifeMonths, productionDate, expiryDate,
  remainingDays, rawResponse
}

// 新响应
data: {
  brand, name, specification, category,
  shelfLifeMonths, productionDate, packageDate,
  rawResponse
}
```

- 移除 `expiryDate` 和 `remainingDays`（不再由识别层计算，表单提交时由 `buildProductRecord` 常规计算）
- 新增 `packageDate`：MiMo 原始识别的包装日期，供前端展示核对

### 5. 前端 `add.js` 简化

识别成功后的表单填充：

```javascript
// 旧
formData.productionDate = data.productionDate || this.data.today;
formData.shelfLifeMonths = data.shelfLifeMonths > 0 ? String(data.shelfLifeMonths) : '36';

// 新
formData.productionDate = data.productionDate || this.data.today; // 云函数已推断，null 时兜底
formData.shelfLifeMonths = String(data.shelfLifeMonths || 36);

// 新增：展示包装原始日期供用户核对
if (data.packageDate) {
  // 可在识别成功提示中展示，如 "包装日期: 2027-06-15，已推断为有效期至"
}
```

---

## 数据流示意

```
输入图片（如：MARIE DALGAR 眼影盘，包装印有 "20290426"）
        │
        ▼
    MiMo 识别
        │  packageDate: null (日期格式 "20290426" 不是 YYYY-MM-DD，MiMo 可能不识别)
        │  shelfLifeMonths: null
        ▼
    inferDates(null, null, 2026-06-28)
        │  productionDate: null
        │  shelfLifeMonths: 36
        ▼
    前端兜底
        │  productionDate → 今天 (2026-06-28)
        │  shelfLifeMonths → 36
        │  提示用户核对
```

> **注**：对于 `20290426` 这类紧凑日期格式，MiMo 可能无法自动转为 `YYYY-MM-DD`。未来可考虑在 `normalizeMiMoInfo` 中添加紧凑日期格式（`YYYYMMDD`）的解析兜底，但不在本次设计范围内。

---

## 测试要点

### `inferDates` 单元测试

| 用例 | packageDate | shelfLifeMonths | 今天 | 预期 productionDate |
|------|------------|-----------------|------|-------------------|
| 未来日期→有效期 | 2027-06-01 | null | 2026-06-28 | 2024-06-01 |
| 未来日期+自定义保质期 | 2028-01-01 | 24 | 2026-06-28 | 2026-01-01 |
| 过去日期→生产日期 | 2025-03-15 | null | 2026-06-28 | 2025-03-15 |
| packageDate 为 null | null | null | 2026-06-28 | null |
| 反推后仍在未来（降级） | 2026-07-01 | 36 | 2026-06-28 | 2026-07-01 |
| 过去日期+自定义保质期 | 2026-01-01 | 12 | 2026-06-28 | 2026-01-01 |

### 集成测试

- MiMo 返回 `packageDate` 的 JSON 响应可被正确解析和推断
- 前端 `add.js` 在 `productionDate: null` 时正确兜底为今天
- 手动录入模式不受影响

## 设计约束

1. `packageDate` 是**瞬态识别字段**，仅用于推断过程，**不持久化**到产品数据库记录中
2. MiMo 返回无效或空 `packageDate` 时，前端必须兜底为当天日期，保证表单始终可用
