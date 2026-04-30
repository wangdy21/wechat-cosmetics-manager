/**
 * constants.js 测试 — 常量定义与品牌词库
 */
const {
  PRODUCT_STATUS,
  BRAND_LIST,
  matchBrand,
  extractSpecification,
} = require('../miniprogram/utils/constants');

describe('PRODUCT_STATUS', () => {
  test('contains all 5 status values', () => {
    expect(PRODUCT_STATUS.IN_USE).toBe('in_use');
    expect(PRODUCT_STATUS.EXPIRING_SOON).toBe('expiring_soon');
    expect(PRODUCT_STATUS.EXPIRED).toBe('expired');
    expect(PRODUCT_STATUS.USED_UP).toBe('used_up');
    expect(PRODUCT_STATUS.DISCARDED).toBe('discarded');
  });
});

describe('PRESET_CATEGORIES removed', () => {
  test('is not exported (categories are fully user-defined)', () => {
    const constants = require('../miniprogram/utils/constants');
    expect(constants.PRESET_CATEGORIES).toBeUndefined();
  });
});

describe('BRAND_LIST', () => {
  test('is a non-empty array', () => {
    expect(Array.isArray(BRAND_LIST)).toBe(true);
    expect(BRAND_LIST.length).toBeGreaterThan(0);
  });

  test('contains well-known brands', () => {
    expect(BRAND_LIST).toContain('SK-II');
    expect(BRAND_LIST).toContain('兰蔻');
    expect(BRAND_LIST).toContain('雅诗兰黛');
    expect(BRAND_LIST).toContain('MAC');
    expect(BRAND_LIST).toContain('YSL');
  });
});

describe('matchBrand', () => {
  test('matches brand from product title', () => {
    expect(matchBrand('SK-II 护肤精华露 神仙水 230ml')).toBe('SK-II');
  });

  test('matches Chinese brand name', () => {
    expect(matchBrand('兰蔻小黑瓶精华肌底液 50ml')).toBe('兰蔻');
  });

  test('returns null when no brand matches', () => {
    expect(matchBrand('普通洗面奶 温和清洁')).toBeNull();
  });

  test('matches longest brand name when multiple could match', () => {
    // If both "雅诗兰黛" and a shorter substring exist
    expect(matchBrand('雅诗兰黛小棕瓶眼霜 15ml')).toBe('雅诗兰黛');
  });

  test('is case-insensitive for English brands', () => {
    expect(matchBrand('mac口红 chili色号')).toBe('MAC');
  });
});

describe('extractSpecification', () => {
  test('extracts ml specification', () => {
    expect(extractSpecification('SK-II 神仙水 230ml')).toBe('230ml');
  });

  test('extracts g specification', () => {
    expect(extractSpecification('兰蔻面霜 50g')).toBe('50g');
  });

  test('extracts specification with space before unit', () => {
    expect(extractSpecification('精华液 30 ml')).toBe('30ml');
  });

  test('returns null when no specification found', () => {
    expect(extractSpecification('口红 哑光质地')).toBeNull();
  });

  test('extracts 片 unit', () => {
    expect(extractSpecification('面膜 10片装')).toBe('10片');
  });
});
