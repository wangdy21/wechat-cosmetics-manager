/**
 * display.js 测试
 * 前端展示辅助：进度百分比、剩余天数描述、状态标签
 */

const {
  calcProgressPercent,
  formatRemainingText,
  getStatusLabel,
  getStatusColorClass,
} = require('../miniprogram/utils/display');

describe('calcProgressPercent', () => {
  test('returns 50 when half shelf life has passed', () => {
    // 2024-01-01 生产，36 个月保质期 → 2027-01-01 过期
    // 今天 2025-07-01 = 过了 18 个月 = 50%
    const result = calcProgressPercent('2024-01-01', '2027-01-01', new Date('2025-07-01'));
    expect(result).toBeCloseTo(50, 0);
  });

  test('returns 0 when product just produced', () => {
    const result = calcProgressPercent('2025-01-01', '2026-01-01', new Date('2025-01-01'));
    expect(result).toBe(0);
  });

  test('returns 100 when product expired', () => {
    const result = calcProgressPercent('2024-01-01', '2025-01-01', new Date('2025-01-01'));
    expect(result).toBe(100);
  });

  test('caps at 100 when past expiration', () => {
    const result = calcProgressPercent('2024-01-01', '2025-01-01', new Date('2026-06-01'));
    expect(result).toBe(100);
  });

  test('returns 0 when production date is in the future', () => {
    const result = calcProgressPercent('2026-06-01', '2027-06-01', new Date('2025-01-01'));
    expect(result).toBe(0);
  });
});

describe('formatRemainingText', () => {
  test('returns "X 天" for positive days', () => {
    expect(formatRemainingText(30)).toBe('剩余 30 天');
  });

  test('returns "今天过期" for 0 days', () => {
    expect(formatRemainingText(0)).toBe('今天过期');
  });

  test('returns "已过期 X 天" for negative days', () => {
    expect(formatRemainingText(-5)).toBe('已过期 5 天');
  });

  test('returns "剩余 1 天" for 1 day', () => {
    expect(formatRemainingText(1)).toBe('剩余 1 天');
  });

  test('returns "已过期 1 天" for -1 day', () => {
    expect(formatRemainingText(-1)).toBe('已过期 1 天');
  });
});

describe('getStatusLabel', () => {
  test('returns 在用 for in_use', () => {
    expect(getStatusLabel('in_use')).toBe('在用');
  });

  test('returns 即将过期 for expiring_soon', () => {
    expect(getStatusLabel('expiring_soon')).toBe('即将过期');
  });

  test('returns 已过期 for expired', () => {
    expect(getStatusLabel('expired')).toBe('已过期');
  });

  test('returns 已用完 for used_up', () => {
    expect(getStatusLabel('used_up')).toBe('已用完');
  });

  test('returns 已丢弃 for discarded', () => {
    expect(getStatusLabel('discarded')).toBe('已丢弃');
  });

  test('returns empty for unknown status', () => {
    expect(getStatusLabel('unknown')).toBe('');
  });
});

describe('getStatusColorClass', () => {
  test('returns safe class for in_use', () => {
    expect(getStatusColorClass('in_use')).toBe('safe');
  });

  test('returns warning class for expiring_soon', () => {
    expect(getStatusColorClass('expiring_soon')).toBe('warning');
  });

  test('returns danger class for expired', () => {
    expect(getStatusColorClass('expired')).toBe('danger');
  });

  test('returns secondary for used_up', () => {
    expect(getStatusColorClass('used_up')).toBe('secondary');
  });

  test('returns secondary for discarded', () => {
    expect(getStatusColorClass('discarded')).toBe('secondary');
  });
});
