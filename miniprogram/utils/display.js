/**
 * 展示辅助工具
 * 进度百分比、剩余天数文字、状态标签映射
 */

/**
 * 计算保质期进度百分比（已用时间 / 总保质期）
 * @param {string} productionDate 生产日期 YYYY-MM-DD
 * @param {string} expirationDate 过期日期 YYYY-MM-DD
 * @param {Date} [now] 当前日期
 * @returns {number} 0-100
 */
function calcProgressPercent(productionDate, expirationDate, now) {
  now = now || new Date();
  const prodTime = new Date(productionDate + 'T00:00:00').getTime();
  const expTime = new Date(expirationDate + 'T00:00:00').getTime();
  const nowTime = new Date(now.toISOString().slice(0, 10) + 'T00:00:00').getTime();

  const total = expTime - prodTime;
  if (total <= 0) return 100;

  const elapsed = nowTime - prodTime;
  if (elapsed <= 0) return 0;
  if (elapsed >= total) return 100;

  return Math.round((elapsed / total) * 100);
}

/**
 * 格式化剩余天数为展示文字
 * @param {number} remainingDays
 * @returns {string}
 */
function formatRemainingText(remainingDays) {
  if (remainingDays > 0) return `剩余 ${remainingDays} 天`;
  if (remainingDays === 0) return '今天过期';
  return `已过期 ${Math.abs(remainingDays)} 天`;
}

const STATUS_LABELS = {
  in_use: '在用',
  expiring_soon: '即将过期',
  expired: '已过期',
  used_up: '已用完',
  discarded: '已丢弃',
};

/**
 * 获取状态中文标签
 */
function getStatusLabel(status) {
  return STATUS_LABELS[status] || '';
}

const STATUS_COLOR_MAP = {
  in_use: 'safe',
  expiring_soon: 'warning',
  expired: 'danger',
  used_up: 'secondary',
  discarded: 'secondary',
};

/**
 * 获取状态对应的颜色类名（safe/warning/danger/secondary）
 */
function getStatusColorClass(status) {
  return STATUS_COLOR_MAP[status] || 'secondary';
}

module.exports = {
  calcProgressPercent,
  formatRemainingText,
  getStatusLabel,
  getStatusColorClass,
};
