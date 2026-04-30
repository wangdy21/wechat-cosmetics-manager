/**
 * 日期计算工具（云函数本地副本）
 * 原始文件：miniprogram/utils/date.js
 * 注意：云函数部署时只上传函数目录内文件，无法跨目录引用
 */

/**
 * 给日期字符串加上指定月数，返回 ISO 日期字符串 (YYYY-MM-DD)
 * 处理月末溢出（如 1月31日 + 1月 = 2月28/29日）
 */
function addMonths(dateStr, months) {
  const date = new Date(dateStr + 'T00:00:00');
  const originalDay = date.getDate();
  date.setMonth(date.getMonth() + months);
  // 月末溢出修正：如果日期变了，说明溢出到下月，回退到上月最后一天
  if (date.getDate() !== originalDay) {
    date.setDate(0);
  }
  return formatDate(date);
}

/**
 * 计算过期日期
 * 规则：取 min(未开封过期时间, 开封后过期时间)
 */
function calcExpirationDate(product) {
  const { productionDate, shelfLifeMonths, openedDate, openedShelfLifeMonths } = product;

  const unopenedExpiry = addMonths(productionDate, shelfLifeMonths);

  if (openedDate && openedShelfLifeMonths) {
    const openedExpiry = addMonths(openedDate, openedShelfLifeMonths);
    return unopenedExpiry <= openedExpiry ? unopenedExpiry : openedExpiry;
  }

  return unopenedExpiry;
}

/**
 * 计算距离过期还有多少天
 * 正数=还有X天，0=今天过期，负数=已过期X天
 */
function calcRemainingDays(expirationDate, today) {
  today = today || new Date();
  const expDate = new Date(expirationDate + 'T00:00:00');
  const todayDate = new Date(formatDate(today) + 'T00:00:00');
  const diffMs = expDate.getTime() - todayDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 根据剩余天数和提前提醒天数，返回前端展示状态
 */
function getProductDisplayStatus(remainingDays, advanceDays) {
  if (remainingDays <= 0) return 'expired';
  if (remainingDays <= advanceDays) return 'expiring_soon';
  return 'in_use';
}

/**
 * 格式化 Date 对象为 YYYY-MM-DD
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = {
  addMonths,
  calcExpirationDate,
  calcRemainingDays,
  getProductDisplayStatus,
  formatDate,
};
