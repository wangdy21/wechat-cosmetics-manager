/**
 * parseLink logic.js 测试
 * 商品标题解析：品牌匹配、规格提取、分类推断
 */

const {
  extractItemId,
  parseProductTitle,
  inferCategory,
} = require('../cloudfunctions/parseLink/logic');

describe('extractItemId', () => {
  test('extracts id from standard taobao link', () => {
    expect(extractItemId('https://item.taobao.com/item.htm?id=123456'))
      .toBe('123456');
  });

  test('extracts id from tmall link', () => {
    expect(extractItemId('https://detail.tmall.com/item.htm?id=789012&skuId=abc'))
      .toBe('789012');
  });

  test('extracts id from link with multiple params', () => {
    expect(extractItemId('https://item.taobao.com/item.htm?spm=abc&id=555&ns=1'))
      .toBe('555');
  });

  test('returns null for link without id', () => {
    expect(extractItemId('https://item.taobao.com/item.htm?spm=abc'))
      .toBeNull();
  });

  test('returns null for empty string', () => {
    expect(extractItemId('')).toBeNull();
  });

  test('returns null for null/undefined', () => {
    expect(extractItemId(null)).toBeNull();
    expect(extractItemId(undefined)).toBeNull();
  });
});

describe('parseProductTitle', () => {
  test('extracts brand and spec from title', () => {
    const result = parseProductTitle('兰蔻小黑瓶精华肌底液 50ml');
    expect(result.brand).toBe('兰蔻');
    expect(result.specification).toBe('50ml');
  });

  test('extracts English brand (case-insensitive)', () => {
    const result = parseProductTitle('sk-ii神仙水 230ml 护肤精华');
    expect(result.brand).toBe('SK-II');
    expect(result.specification).toBe('230ml');
  });

  test('extracts specification with g unit', () => {
    const result = parseProductTitle('完美日记蜜粉散粉定妆粉 10g');
    expect(result.specification).toBe('10g');
  });

  test('returns clean name (removes brand from title)', () => {
    const result = parseProductTitle('兰蔻小黑瓶精华肌底液 50ml');
    expect(result.name).not.toContain('兰蔻');
    expect(result.name).toBeTruthy();
  });

  test('returns full title as name when no brand matched', () => {
    const result = parseProductTitle('某牌子神秘面霜 30g');
    expect(result.name).toBe('某牌子神秘面霜 30g');
    expect(result.brand).toBe('');
  });

  test('handles null/empty title', () => {
    const result = parseProductTitle('');
    expect(result.name).toBe('');
    expect(result.brand).toBe('');
    expect(result.specification).toBe('');
  });
});

describe('inferCategory', () => {
  test('infers 护肤 from title keywords', () => {
    expect(inferCategory('精华液面霜水乳')).toBe('护肤');
  });

  test('infers 彩妆 from title keywords', () => {
    expect(inferCategory('口红唇釉哑光')).toBe('彩妆');
  });

  test('infers 美发 from title keywords', () => {
    expect(inferCategory('洗发水护发素')).toBe('美发');
  });

  test('infers 身体护理 from title keywords', () => {
    expect(inferCategory('身体乳沐浴露')).toBe('身体护理');
  });

  test('infers 香水 from title keywords', () => {
    expect(inferCategory('淡香水香氛')).toBe('香水');
  });

  test('returns empty for unrecognized title', () => {
    expect(inferCategory('随便什么东西')).toBe('');
  });

  test('handles empty/null', () => {
    expect(inferCategory('')).toBe('');
    expect(inferCategory(null)).toBe('');
  });
});
