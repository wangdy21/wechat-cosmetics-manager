/**
 * productOps 业务逻辑测试
 * 测试纯逻辑函数，不依赖 wx-server-sdk
 */
const {
  buildProductRecord,
  recalcOnUpdate,
  validateAddInput,
  validateUpdateStatusInput,
  resolveStatus,
} = require('../cloudfunctions/productOps/logic');

describe('validateAddInput', () => {
  const validInput = {
    name: 'SK-II 神仙水',
    brand: 'SK-II',
    category: '护肤',
    specification: '230ml',
    productionDate: '2025-01-01',
    shelfLifeMonths: 36,
  };

  test('returns null for valid input', () => {
    expect(validateAddInput(validInput)).toBeNull();
  });

  test('returns error when name is missing', () => {
    expect(validateAddInput({ ...validInput, name: '' })).toBe('产品名称不能为空');
  });

  test('returns error when productionDate is missing', () => {
    expect(validateAddInput({ ...validInput, productionDate: '' })).toBe('生产日期不能为空');
  });

  test('returns error when shelfLifeMonths is missing', () => {
    expect(validateAddInput({ ...validInput, shelfLifeMonths: 0 })).toBe('保质期必须大于0');
  });

  test('returns error when shelfLifeMonths is negative', () => {
    expect(validateAddInput({ ...validInput, shelfLifeMonths: -1 })).toBe('保质期必须大于0');
  });

  test('returns error when category is missing', () => {
    expect(validateAddInput({ ...validInput, category: '' })).toBe('分类不能为空');
  });
});

describe('validateUpdateStatusInput', () => {
  test('accepts used_up status', () => {
    expect(validateUpdateStatusInput('used_up')).toBeNull();
  });

  test('accepts discarded status', () => {
    expect(validateUpdateStatusInput('discarded')).toBeNull();
  });

  test('rejects in_use status', () => {
    expect(validateUpdateStatusInput('in_use')).toBe('只能标记为 used_up 或 discarded');
  });

  test('rejects expired status', () => {
    expect(validateUpdateStatusInput('expired')).toBe('只能标记为 used_up 或 discarded');
  });

  test('rejects empty status', () => {
    expect(validateUpdateStatusInput('')).toBe('状态不能为空');
  });
});

describe('resolveStatus', () => {
  test('returns expired when expiration is past', () => {
    expect(resolveStatus('2025-01-01', 30, new Date('2026-03-31'))).toBe('expired');
  });

  test('returns expiring_soon when within advance days', () => {
    expect(resolveStatus('2026-04-15', 30, new Date('2026-03-31'))).toBe('expiring_soon');
  });

  test('returns in_use when far from expiration', () => {
    expect(resolveStatus('2028-01-01', 30, new Date('2026-03-31'))).toBe('in_use');
  });

  test('returns expired when expiration is today', () => {
    expect(resolveStatus('2026-03-31', 30, new Date('2026-03-31'))).toBe('expired');
  });

  test('uses default advanceDays of 30 when not provided', () => {
    // 15 days away, default 30 days advance
    expect(resolveStatus('2026-04-15', undefined, new Date('2026-03-31'))).toBe('expiring_soon');
  });
});

describe('buildProductRecord', () => {
  const input = {
    name: 'SK-II 神仙水',
    brand: 'SK-II',
    category: '护肤',
    specification: '230ml',
    productionDate: '2025-01-01',
    shelfLifeMonths: 36,
  };

  test('builds record with calculated expirationDate', () => {
    const record = buildProductRecord(input, 30, new Date('2026-03-31'));
    expect(record.expirationDate).toBe('2028-01-01');
  });

  test('sets status to in_use when expiration is far', () => {
    const record = buildProductRecord(input, 30, new Date('2026-03-31'));
    expect(record.status).toBe('in_use');
  });

  test('sets status to expired when already past', () => {
    const pastInput = { ...input, shelfLifeMonths: 6 };
    // 2025-01-01 + 6 months = 2025-07-01, well past 2026-03-31
    const record = buildProductRecord(pastInput, 30, new Date('2026-03-31'));
    expect(record.status).toBe('expired');
  });

  test('includes openedDate and openedShelfLifeMonths when provided', () => {
    const openedInput = {
      ...input,
      openedDate: '2026-01-01',
      openedShelfLifeMonths: 6,
    };
    const record = buildProductRecord(openedInput, 30, new Date('2026-03-31'));
    expect(record.openedDate).toBe('2026-01-01');
    expect(record.openedShelfLifeMonths).toBe(6);
    // opened expiry: 2026-01-01 + 6 = 2026-07-01
    // unopened expiry: 2025-01-01 + 36 = 2028-01-01
    // min = 2026-07-01
    expect(record.expirationDate).toBe('2026-07-01');
  });

  test('sets default null for optional fields', () => {
    const record = buildProductRecord(input, 30, new Date('2026-03-31'));
    expect(record.openedDate).toBeNull();
    expect(record.openedShelfLifeMonths).toBeNull();
    expect(record.sourceLink).toBe('');
    expect(record.imageUrl).toBe('');
  });

  test('includes createdAt and updatedAt', () => {
    const now = new Date('2026-03-31T10:00:00Z');
    const record = buildProductRecord(input, 30, now);
    expect(record.createdAt).toBe(now.toISOString());
    expect(record.updatedAt).toBe(now.toISOString());
  });
});

describe('recalcOnUpdate', () => {
  const existing = {
    name: 'SK-II 神仙水',
    brand: 'SK-II',
    category: '护肤',
    specification: '230ml',
    productionDate: '2025-01-01',
    shelfLifeMonths: 36,
    expirationDate: '2028-01-01',
    status: 'in_use',
    openedDate: null,
    openedShelfLifeMonths: null,
  };

  test('recalculates when productionDate changes', () => {
    const updates = { productionDate: '2025-06-01' };
    const result = recalcOnUpdate(existing, updates, 30, new Date('2026-03-31'));
    expect(result.expirationDate).toBe('2028-06-01');
  });

  test('recalculates when shelfLifeMonths changes', () => {
    const updates = { shelfLifeMonths: 12 };
    const result = recalcOnUpdate(existing, updates, 30, new Date('2026-03-31'));
    // 2025-01-01 + 12 = 2026-01-01, already past -> expired
    expect(result.expirationDate).toBe('2026-01-01');
    expect(result.status).toBe('expired');
  });

  test('recalculates when openedDate is set', () => {
    const updates = { openedDate: '2026-01-01', openedShelfLifeMonths: 3 };
    const result = recalcOnUpdate(existing, updates, 30, new Date('2026-03-31'));
    // opened: 2026-01-01 + 3 = 2026-04-01
    // unopened: 2028-01-01
    // min = 2026-04-01 (1 day away from today 2026-03-31)
    expect(result.expirationDate).toBe('2026-04-01');
    expect(result.status).toBe('expiring_soon');
  });

  test('does not recalculate when unrelated fields change', () => {
    const updates = { name: 'SK-II 精华露' };
    const result = recalcOnUpdate(existing, updates, 30, new Date('2026-03-31'));
    expect(result.expirationDate).toBeUndefined();
    expect(result.status).toBeUndefined();
  });

  test('always includes updatedAt', () => {
    const now = new Date('2026-03-31T10:00:00Z');
    const result = recalcOnUpdate(existing, { name: 'test' }, 30, now);
    expect(result.updatedAt).toBe(now.toISOString());
  });
});
