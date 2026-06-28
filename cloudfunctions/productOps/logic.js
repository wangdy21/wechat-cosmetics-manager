/**
 * productOps 业务逻辑
 * 纯函数，不依赖 wx-server-sdk，可独立测试
 */
const { calcExpirationDate, calcRemainingDays, addMonths } = require('./date');

/**
 * 校验添加产品的输入
 * @returns {string|null} 错误信息，null 表示通过
 */
function validateAddInput(data) {
  if (!data.name || !data.name.trim()) return '产品名称不能为空';
  if (!data.category || !data.category.trim()) return '分类不能为空';
  if (!data.productionDate) return '生产日期不能为空';
  if (!data.shelfLifeMonths || data.shelfLifeMonths <= 0) return '保质期必须大于0';
  return null;
}

/**
 * 校验更新产品的输入
 * 仅校验提交的字段，未提交的字段不校验
 * @returns {string|null} 错误信息，null 表示通过
 */
function validateUpdateInput(data) {
  if (data.name !== undefined && !data.name.trim()) return '产品名称不能为空';
  if (data.category !== undefined && !data.category.trim()) return '分类不能为空';
  if (data.productionDate !== undefined && !data.productionDate) return '生产日期不能为空';
  if (data.shelfLifeMonths !== undefined && (!data.shelfLifeMonths || data.shelfLifeMonths <= 0)) return '保质期必须大于0';
  return null;
}

/**
 * 校验用户主动标记状态的输入
 * @returns {string|null} 错误信息
 */
function validateUpdateStatusInput(status) {
  if (!status) return '状态不能为空';
  if (status !== 'used_up' && status !== 'discarded') {
    return '只能标记为 used_up 或 discarded';
  }
  return null;
}

/**
 * 根据过期日期和提前天数，决定产品初始状态
 */
function resolveStatus(expirationDate, advanceDays, now) {
  const advance = advanceDays || 30;
  const remaining = calcRemainingDays(expirationDate, now);
  if (remaining <= 0) return 'expired';
  if (remaining <= advance) return 'expiring_soon';
  return 'in_use';
}

/**
 * 根据输入构建完整的产品记录
 */
function buildProductRecord(data, advanceDays, now) {
  const expirationDate = calcExpirationDate({
    productionDate: data.productionDate,
    shelfLifeMonths: data.shelfLifeMonths,
    openedDate: data.openedDate || null,
    openedShelfLifeMonths: data.openedShelfLifeMonths || null,
  });

  const status = resolveStatus(expirationDate, advanceDays, now);

  // 商品来源：link（链接导入）、image（图片识别）或 manual（手动录入）
  const validSources = ['link', 'image', 'manual'];
  const source = validSources.indexOf(data.source) !== -1 ? data.source : 'manual';

  return {
    name: data.name.trim(),
    brand: (data.brand || '').trim(),
    category: data.category.trim(),
    specification: (data.specification || '').trim(),
    imageUrl: data.imageUrl || '',
    sourceLink: data.sourceLink || '',
    source,
    productionDate: data.productionDate,
    shelfLifeMonths: data.shelfLifeMonths,
    expirationDate,
    status,
    openedDate: data.openedDate || null,
    openedShelfLifeMonths: data.openedShelfLifeMonths || null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/**
 * 更新产品时，判断是否需要重算过期时间和状态
 * 返回需要合并到更新操作中的额外字段
 */
function recalcOnUpdate(existing, updates, advanceDays, now) {
  const result = { updatedAt: now.toISOString() };

  const dateFields = ['productionDate', 'shelfLifeMonths', 'openedDate', 'openedShelfLifeMonths'];
  const needsRecalc = dateFields.some((field) => updates[field] !== undefined);

  if (needsRecalc) {
    const merged = { ...existing, ...updates };
    const expirationDate = calcExpirationDate({
      productionDate: merged.productionDate,
      shelfLifeMonths: merged.shelfLifeMonths,
      openedDate: merged.openedDate,
      openedShelfLifeMonths: merged.openedShelfLifeMonths,
    });
    result.expirationDate = expirationDate;
    result.status = resolveStatus(expirationDate, advanceDays, now);
  }

  return result;
}

const DEFAULT_SHELF_LIFE_MONTHS = 36;

/**
 * 根据包装日期和保质期推断生产日期
 *
 * @param {string|null} packageDate 包装上印刷的日期 YYYY-MM-DD
 * @param {number|null} shelfLifeMonths 保质期月数
 * @param {string|Date} today 当前日期
 * @returns {{ productionDate: string|null, shelfLifeMonths: number }}
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
    const prodDate = addMonths(packageDate, -months);
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

module.exports = {
  validateAddInput,
  validateUpdateInput,
  validateUpdateStatusInput,
  resolveStatus,
  buildProductRecord,
  recalcOnUpdate,
  inferDates,
};
