/**
 * date.js 测试 — 过期时间计算核心逻辑
 */
const {
  addMonths,
  calcExpirationDate,
  calcRemainingDays,
  getProductDisplayStatus,
} = require('../miniprogram/utils/date');

describe('addMonths', () => {
  test('adds months to a date string and returns ISO date', () => {
    expect(addMonths('2025-01-15', 12)).toBe('2026-01-15');
  });

  test('handles month overflow (Jan 31 + 1 month = Feb 28)', () => {
    expect(addMonths('2025-01-31', 1)).toBe('2025-02-28');
  });

  test('handles leap year (Jan 31 + 1 month in leap year = Feb 29)', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
  });

  test('handles year boundary (Dec + 1 month = next year Jan)', () => {
    expect(addMonths('2025-12-15', 1)).toBe('2026-01-15');
  });

  test('adds 36 months correctly', () => {
    expect(addMonths('2025-06-01', 36)).toBe('2028-06-01');
  });
});

describe('calcExpirationDate', () => {
  test('calculates expiration from production date and shelf life', () => {
    const result = calcExpirationDate({
      productionDate: '2025-01-01',
      shelfLifeMonths: 24,
    });
    expect(result).toBe('2027-01-01');
  });

  test('returns earlier of unopened and opened expiration when opened', () => {
    // Unopened: 2025-01-01 + 36 months = 2028-01-01
    // Opened:  2026-06-01 + 6 months  = 2026-12-01
    // Result:  2026-12-01 (earlier)
    const result = calcExpirationDate({
      productionDate: '2025-01-01',
      shelfLifeMonths: 36,
      openedDate: '2026-06-01',
      openedShelfLifeMonths: 6,
    });
    expect(result).toBe('2026-12-01');
  });

  test('returns unopened expiration when it is earlier than opened', () => {
    // Unopened: 2025-01-01 + 12 months = 2026-01-01
    // Opened:  2025-06-01 + 12 months = 2026-06-01
    // Result:  2026-01-01 (earlier)
    const result = calcExpirationDate({
      productionDate: '2025-01-01',
      shelfLifeMonths: 12,
      openedDate: '2025-06-01',
      openedShelfLifeMonths: 12,
    });
    expect(result).toBe('2026-01-01');
  });

  test('ignores opened fields when openedDate is null', () => {
    const result = calcExpirationDate({
      productionDate: '2025-03-15',
      shelfLifeMonths: 24,
      openedDate: null,
      openedShelfLifeMonths: null,
    });
    expect(result).toBe('2027-03-15');
  });

  test('ignores opened fields when openedShelfLifeMonths is null', () => {
    const result = calcExpirationDate({
      productionDate: '2025-03-15',
      shelfLifeMonths: 24,
      openedDate: '2025-06-01',
      openedShelfLifeMonths: null,
    });
    expect(result).toBe('2027-03-15');
  });
});

describe('calcRemainingDays', () => {
  test('returns positive days when expiration is in the future', () => {
    const today = new Date('2026-03-31');
    const result = calcRemainingDays('2026-04-30', today);
    expect(result).toBe(30);
  });

  test('returns 0 when expiration is today', () => {
    const today = new Date('2026-03-31');
    const result = calcRemainingDays('2026-03-31', today);
    expect(result).toBe(0);
  });

  test('returns negative days when already expired', () => {
    const today = new Date('2026-03-31');
    const result = calcRemainingDays('2026-03-01', today);
    expect(result).toBe(-30);
  });
});

describe('getProductDisplayStatus', () => {
  test('returns "expired" when remaining days < 0', () => {
    expect(getProductDisplayStatus(-5, 30)).toBe('expired');
  });

  test('returns "expired" when remaining days is 0', () => {
    expect(getProductDisplayStatus(0, 30)).toBe('expired');
  });

  test('returns "expiring_soon" when remaining days <= advanceDays', () => {
    expect(getProductDisplayStatus(15, 30)).toBe('expiring_soon');
  });

  test('returns "expiring_soon" when remaining days equals advanceDays', () => {
    expect(getProductDisplayStatus(30, 30)).toBe('expiring_soon');
  });

  test('returns "in_use" when remaining days > advanceDays', () => {
    expect(getProductDisplayStatus(60, 30)).toBe('in_use');
  });
});
