/**
 * parser.js 测试
 * 前端链接预处理：识别链接类型、提取 URL / 淘口令
 */

const { identifyLinkType, extractUrl, parseInput } = require('../miniprogram/utils/parser');

describe('identifyLinkType', () => {
  test('identifies standard taobao item link', () => {
    expect(identifyLinkType('https://item.taobao.com/item.htm?id=123456'))
      .toBe('taobao_link');
  });

  test('identifies standard tmall item link', () => {
    expect(identifyLinkType('https://detail.tmall.com/item.htm?id=789'))
      .toBe('taobao_link');
  });

  test('identifies taobao short link (m.tb.cn)', () => {
    expect(identifyLinkType('https://m.tb.cn/h.abc123'))
      .toBe('short_link');
  });

  test('identifies taobao short link (e.tb.cn)', () => {
    expect(identifyLinkType('https://e.tb.cn/h.RWhTUz42rR221f1?tk=Ejbk5FHc4h5'))
      .toBe('short_link');
  });

  test('identifies taobao short link embedded in share text', () => {
    expect(identifyLinkType('【淘宝】大促价保 https://e.tb.cn/h.RWhTUz42rR221f1?tk=Ejbk5FHc4h5 CZ028 「410」点击链接直接打开'))
      .toBe('short_link');
  });

  test('identifies taokou-ling text (with ¥ delimiters)', () => {
    expect(identifyLinkType('¥abcDEF123¥'))
      .toBe('taokou_ling');
  });

  test('identifies taokou-ling with surrounding text', () => {
    expect(identifyLinkType('快来看看这个 ¥abcDEF123¥ 很好用'))
      .toBe('taokou_ling');
  });

  test('identifies taokou-ling with ￥ delimiter', () => {
    expect(identifyLinkType('￥abcDEF123￥'))
      .toBe('taokou_ling');
  });

  test('returns unknown for unrelated text', () => {
    expect(identifyLinkType('这是一段普通文字'))
      .toBe('unknown');
  });

  test('returns unknown for empty string', () => {
    expect(identifyLinkType(''))
      .toBe('unknown');
  });

  test('returns unknown for null/undefined', () => {
    expect(identifyLinkType(null)).toBe('unknown');
    expect(identifyLinkType(undefined)).toBe('unknown');
  });

  test('identifies http taobao link (non-https)', () => {
    expect(identifyLinkType('http://item.taobao.com/item.htm?id=123'))
      .toBe('taobao_link');
  });

  test('identifies taobao link embedded in text', () => {
    expect(identifyLinkType('看看这个 https://item.taobao.com/item.htm?id=123 很好用'))
      .toBe('taobao_link');
  });

  test('identifies short link embedded in text', () => {
    expect(identifyLinkType('推荐 https://m.tb.cn/h.abc123 给你'))
      .toBe('short_link');
  });
});

describe('extractUrl', () => {
  test('extracts URL from standard taobao link', () => {
    expect(extractUrl('https://item.taobao.com/item.htm?id=123456', 'taobao_link'))
      .toBe('https://item.taobao.com/item.htm?id=123456');
  });

  test('extracts URL from text containing taobao link', () => {
    const result = extractUrl('看看这个 https://item.taobao.com/item.htm?id=123 好用', 'taobao_link');
    expect(result).toBe('https://item.taobao.com/item.htm?id=123');
  });

  test('extracts URL from tmall link', () => {
    expect(extractUrl('https://detail.tmall.com/item.htm?id=789&skuId=abc', 'taobao_link'))
      .toBe('https://detail.tmall.com/item.htm?id=789&skuId=abc');
  });

  test('extracts short link URL (m.tb.cn)', () => {
    expect(extractUrl('推荐 https://m.tb.cn/h.abc123 给你', 'short_link'))
      .toBe('https://m.tb.cn/h.abc123');
  });

  test('extracts short link URL (e.tb.cn)', () => {
    expect(extractUrl('【淘宝】大促价保 https://e.tb.cn/h.RWhTUz42rR221f1?tk=Ejbk5FHc4h5 CZ028 「410」', 'short_link'))
      .toBe('https://e.tb.cn/h.RWhTUz42rR221f1?tk=Ejbk5FHc4h5');
  });

  test('extracts taokou-ling code with ¥', () => {
    expect(extractUrl('快来看 ¥abcDEF123¥ 好用', 'taokou_ling'))
      .toBe('abcDEF123');
  });

  test('extracts taokou-ling code with ￥', () => {
    expect(extractUrl('￥Xz9Abc￥', 'taokou_ling'))
      .toBe('Xz9Abc');
  });

  test('returns null for unknown type', () => {
    expect(extractUrl('random text', 'unknown'))
      .toBeNull();
  });

  test('returns null when extraction fails', () => {
    expect(extractUrl('', 'taobao_link'))
      .toBeNull();
  });
});

describe('parseInput', () => {
  test('parses standard taobao link', () => {
    const result = parseInput('https://item.taobao.com/item.htm?id=123');
    expect(result).toEqual({
      type: 'taobao_link',
      value: 'https://item.taobao.com/item.htm?id=123',
    });
  });

  test('parses tmall link', () => {
    const result = parseInput('https://detail.tmall.com/item.htm?id=456');
    expect(result).toEqual({
      type: 'taobao_link',
      value: 'https://detail.tmall.com/item.htm?id=456',
    });
  });

  test('parses short link (m.tb.cn)', () => {
    const result = parseInput('https://m.tb.cn/h.xyz789');
    expect(result).toEqual({
      type: 'short_link',
      value: 'https://m.tb.cn/h.xyz789',
    });
  });

  test('parses short link (e.tb.cn) from share text', () => {
    const result = parseInput('【淘宝】大促价保 https://e.tb.cn/h.RWhTUz42rR221f1?tk=Ejbk5FHc4h5 CZ028 「410」点击链接直接打开 或者 淘宝搜索直接打开');
    expect(result.type).toBe('short_link');
    expect(result.value).toBe('https://e.tb.cn/h.RWhTUz42rR221f1?tk=Ejbk5FHc4h5');
  });

  test('parses taokou-ling from text', () => {
    const result = parseInput('快来看看 ¥abc123DEF¥ 很好用哦');
    expect(result).toEqual({
      type: 'taokou_ling',
      value: 'abc123DEF',
    });
  });

  test('returns error for unrecognized input', () => {
    const result = parseInput('这是一段普通文字');
    expect(result).toEqual({
      type: 'unknown',
      value: null,
    });
  });

  test('returns error for empty input', () => {
    const result = parseInput('');
    expect(result).toEqual({
      type: 'unknown',
      value: null,
    });
  });

  test('returns error for null input', () => {
    const result = parseInput(null);
    expect(result).toEqual({
      type: 'unknown',
      value: null,
    });
  });

  test('handles link with extra query params', () => {
    const result = parseInput('https://item.taobao.com/item.htm?id=123&spm=abc&ns=1');
    expect(result.type).toBe('taobao_link');
    expect(result.value).toContain('id=123');
  });

  test('handles mixed taokou-ling delimiters ¥ and ￥', () => {
    const result = parseInput('￥testCode¥');
    expect(result.type).toBe('taokou_ling');
    expect(result.value).toBe('testCode');
  });
});
