/**
 * reminder logic.js 测试
 * 批量状态更新逻辑：判断哪些产品需要更新状态
 */

const { classifyProducts } = require('../cloudfunctions/reminder/logic');

describe('classifyProducts', () => {
  const now = new Date('2025-06-01');

  test('marks expired product as "expired"', () => {
    const products = [
      { _id: '1', _openid: 'u1', status: 'in_use', expirationDate: '2025-05-31' },
    ];
    const settings = { u1: { advanceDays: 30 } };
    const result = classifyProducts(products, settings, now);
    expect(result.toExpire).toEqual([{ _id: '1', _openid: 'u1' }]);
    expect(result.toExpiringSoon).toEqual([]);
  });

  test('marks expiring_soon product when within advance days', () => {
    const products = [
      { _id: '2', _openid: 'u1', status: 'in_use', expirationDate: '2025-06-20' },
    ];
    const settings = { u1: { advanceDays: 30 } };
    const result = classifyProducts(products, settings, now);
    expect(result.toExpiringSoon).toEqual([{ _id: '2', _openid: 'u1' }]);
    expect(result.toExpire).toEqual([]);
  });

  test('does not change product that is still safe', () => {
    const products = [
      { _id: '3', _openid: 'u1', status: 'in_use', expirationDate: '2025-12-01' },
    ];
    const settings = { u1: { advanceDays: 30 } };
    const result = classifyProducts(products, settings, now);
    expect(result.toExpire).toEqual([]);
    expect(result.toExpiringSoon).toEqual([]);
  });

  test('uses default advanceDays when user has no settings', () => {
    const products = [
      { _id: '4', _openid: 'u2', status: 'in_use', expirationDate: '2025-06-25' },
    ];
    const settings = {}; // no settings for u2
    const result = classifyProducts(products, settings, now);
    // default 30 days, 2025-06-25 is 24 days away → expiring_soon
    expect(result.toExpiringSoon).toEqual([{ _id: '4', _openid: 'u2' }]);
  });

  test('correctly handles already expiring_soon product that expires', () => {
    const products = [
      { _id: '5', _openid: 'u1', status: 'expiring_soon', expirationDate: '2025-05-30' },
    ];
    const settings = { u1: { advanceDays: 30 } };
    const result = classifyProducts(products, settings, now);
    expect(result.toExpire).toEqual([{ _id: '5', _openid: 'u1' }]);
  });

  test('handles multiple products from different users', () => {
    const products = [
      { _id: 'a', _openid: 'u1', status: 'in_use', expirationDate: '2025-05-20' },
      { _id: 'b', _openid: 'u2', status: 'in_use', expirationDate: '2025-06-10' },
      { _id: 'c', _openid: 'u1', status: 'in_use', expirationDate: '2025-12-01' },
    ];
    const settings = { u1: { advanceDays: 30 }, u2: { advanceDays: 15 } };
    const result = classifyProducts(products, settings, now);
    expect(result.toExpire).toEqual([{ _id: 'a', _openid: 'u1' }]);
    expect(result.toExpiringSoon).toEqual([{ _id: 'b', _openid: 'u2' }]);
  });

  test('returns empty arrays for empty product list', () => {
    const result = classifyProducts([], {}, now);
    expect(result.toExpire).toEqual([]);
    expect(result.toExpiringSoon).toEqual([]);
  });

  test('product expiring today is marked as expired', () => {
    const products = [
      { _id: '6', _openid: 'u1', status: 'in_use', expirationDate: '2025-06-01' },
    ];
    const settings = { u1: { advanceDays: 30 } };
    const result = classifyProducts(products, settings, now);
    expect(result.toExpire).toEqual([{ _id: '6', _openid: 'u1' }]);
  });
});
