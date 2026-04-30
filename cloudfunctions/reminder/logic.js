/**
 * reminder 业务逻辑
 * 纯函数，不依赖 wx-server-sdk，可独立测试
 * 批量状态分类：判断哪些产品需要状态更新
 */
const { calcRemainingDays } = require('./date');

const DEFAULT_ADVANCE_DAYS = 30;

/**
 * 对产品列表进行状态分类
 * @param {Array} products 活跃产品列表（status 为 in_use 或 expiring_soon）
 * @param {Object} settings 用户设置映射 { openid: { advanceDays } }
 * @param {Date} now 当前时间
 * @returns {{ toExpire: Array, toExpiringSoon: Array }}
 */
function classifyProducts(products, settings, now) {
  const toExpire = [];
  const toExpiringSoon = [];

  for (const product of products) {
    const userSettings = settings[product._openid] || {};
    const advanceDays = userSettings.advanceDays || DEFAULT_ADVANCE_DAYS;
    const remaining = calcRemainingDays(product.expirationDate, now);

    if (remaining <= 0) {
      // 过期或今天过期 → 标记为 expired
      if (product.status !== 'expired') {
        toExpire.push({ _id: product._id, _openid: product._openid });
      }
    } else if (remaining <= advanceDays) {
      // 在提醒窗口内 → 标记为 expiring_soon
      if (product.status !== 'expiring_soon') {
        toExpiringSoon.push({ _id: product._id, _openid: product._openid });
      }
    }
  }

  return { toExpire, toExpiringSoon };
}

module.exports = {
  classifyProducts,
};
