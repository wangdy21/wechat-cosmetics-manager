/**
 * OCR 文本解析器测试
 */
const { extractProductInfo } = require('../cloudfunctions/productOps/textParser');

describe('extractProductInfo', () => {
  test('extracts brand from key-value pair', () => {
    const lines = ['品牌：YSL/圣罗兰', '产品名称：圣罗兰全新细管口红'];
    const result = extractProductInfo(lines);
    expect(result.brand).toBe('YSL');
  });

  test('extracts brand from full text via brand list', () => {
    const lines = ['兰蔻小黑瓶精华肌底液 50ml'];
    const result = extractProductInfo(lines);
    expect(result.brand).toBe('兰蔻');
  });

  test('extracts product name from key-value pair', () => {
    const lines = ['产品名称：圣罗兰全新细管口红', '品牌：YSL'];
    const result = extractProductInfo(lines);
    expect(result.name).toBe('圣罗兰全新细管口红');
  });

  test('extracts specification from net content', () => {
    const lines = ['净含量：2.2g', '品牌：YSL'];
    const result = extractProductInfo(lines);
    expect(result.specification).toBe('2.2g');
  });

  test('extracts specification from full text', () => {
    const lines = ['兰蔻小黑瓶精华肌底液 50ml'];
    const result = extractProductInfo(lines);
    expect(result.specification).toBe('50ml');
  });

  test('extracts specification with decimal', () => {
    const lines = ['SK-II 神仙水 230ml'];
    const result = extractProductInfo(lines);
    expect(result.specification).toBe('230ml');
  });

  test('extracts category from product category field', () => {
    const lines = ['产品类别：口红/唇膏', '品牌：YSL'];
    const result = extractProductInfo(lines);
    expect(result.category).toBe('口红');
  });

  test('extracts category from full text keywords', () => {
    const lines = ['兰蔻粉底液 持妆遮瑕', '规格：30ml'];
    const result = extractProductInfo(lines);
    expect(result.category).toBe('底妆');
  });

  test('handles complex OCR output with multiple fields', () => {
    const lines = [
      '质地 哑光',
      '功效 保湿, 美容修饰',
      '限期使用日期范围 2027-06-01 至 2028-05-31',
      '化妆品备案编号/注册证号 国妆网备进字（沪）2025002277',
      '品牌 YSL/圣罗兰',
      'YSL/圣罗兰单品 细管纯口红',
      '产品名称 圣罗兰全新细管口红',
      '净含量 2.2g',
      '产地 法国',
      '规格类型 正常规格',
      '产品类别 口红/唇膏',
    ];
    const result = extractProductInfo(lines);
    expect(result.brand).toBe('YSL');
    expect(result.name).toBe('圣罗兰全新细管口红');
    expect(result.specification).toBe('2.2g');
    expect(result.category).toBe('口红');
  });

  test('returns empty fields for empty input', () => {
    const result = extractProductInfo([]);
    expect(result.brand).toBe('');
    expect(result.name).toBe('');
    expect(result.specification).toBe('');
    expect(result.category).toBe('');
  });

  test('returns empty fields for null input', () => {
    const result = extractProductInfo(null);
    expect(result.brand).toBe('');
    expect(result.name).toBe('');
    expect(result.specification).toBe('');
    expect(result.category).toBe('');
  });

  test('handles skincare product', () => {
    const lines = [
      '品牌：兰蔻',
      '产品名称：小黑瓶精华肌底液',
      '净含量：50ml',
      '产品类别：精华液',
    ];
    const result = extractProductInfo(lines);
    expect(result.brand).toBe('兰蔻');
    expect(result.name).toBe('小黑瓶精华肌底液');
    expect(result.specification).toBe('50ml');
    expect(result.category).toBe('精华');
  });

  test('handles sunscreen product', () => {
    const lines = ['安耐晒防晒霜 SPF50+ 60ml'];
    const result = extractProductInfo(lines);
    expect(result.specification).toBe('60ml');
    expect(result.category).toBe('防晒');
  });

  // --- 新增：保质期、限期使用日期、生产日期提取测试 ---

  test('extracts shelf life in years (保质期：3年)', () => {
    const lines = ['品牌：YSL/圣罗兰', '保质期：3年'];
    const result = extractProductInfo(lines);
    expect(result.shelfLifeMonths).toBe(36);
  });

  test('extracts shelf life in months (保质期：36个月)', () => {
    const lines = ['品牌：兰蔻', '保质期：36个月'];
    const result = extractProductInfo(lines);
    expect(result.shelfLifeMonths).toBe(36);
  });

  test('extracts expiry date range and uses end date', () => {
    const lines = ['限期使用日期范围：2027-06-01 至 2028-05-31'];
    const result = extractProductInfo(lines);
    expect(result.expiryDate).toBe('2028-05-31');
  });

  test('calculates production date from expiry and shelf life', () => {
    const lines = [
      '保质期：3年',
      '限期使用日期范围：2027-06-01 至 2028-05-31',
    ];
    const result = extractProductInfo(lines);
    expect(result.shelfLifeMonths).toBe(36);
    expect(result.expiryDate).toBe('2028-05-31');
    // 2028-05-31 减去 36 个月 = 2025-05-31
    expect(result.productionDate).toBe('2025-05-31');
  });

  test('returns null for missing shelf life and expiry', () => {
    const lines = ['品牌：YSL', '产品名称：口红'];
    const result = extractProductInfo(lines);
    expect(result.shelfLifeMonths).toBeNull();
    expect(result.expiryDate).toBeNull();
    expect(result.productionDate).toBeNull();
  });

  test('full OCR output from YSL lipstick image (image 1)', () => {
    const lines = [
      '质地 哑光',
      '功效 保湿, 美容修饰',
      '限期使用日期范围 2027-06-01 至 2028-05-31',
      '化妆品备案编号/注册证号 国妆网备进字（沪）2025002277',
      '品牌 YSL/圣罗兰',
      '产品名称 圣罗兰全新细管口红',
      '净含量 2.2g',
      '产地 法国',
      '规格类型 正常规格',
      '包装种类 基础包装',
      '是否为特殊用途化妆品 否',
      '生产企业名称 BEAUTE RECHERCHE & INDUSTRIES',
      '产品类别 口红/唇膏',
    ];
    const result = extractProductInfo(lines);
    expect(result.brand).toBe('YSL');
    expect(result.name).toBe('圣罗兰全新细管口红');
    expect(result.specification).toBe('2.2g');
    expect(result.category).toBe('口红');
    expect(result.expiryDate).toBe('2028-05-31');
  });

  test('full OCR output from YSL essence image (image 2)', () => {
    const lines = [
      '多种肤质（敏感肌除外）',
      '保湿,修护,去角质',
      '品牌 YSL/圣罗兰',
      '化妆品备案 国妆网备进字（沪）2023003022',
      '保质期 3年',
      '净含量 1瓶 30ml',
      '规格类型 正常规格',
      '生产厂家名称 Accredited Contract Packager',
      '全新悦享青春夜间焕肤精华液',
      '质地 其他',
      '限期使用日期范围 2027-06-01 至 2028-05-31',
      '产地 法国',
      '是否为特殊用途化妆品 否',
      '包装数量 1支',
    ];
    const result = extractProductInfo(lines);
    expect(result.brand).toBe('YSL');
    expect(result.specification).toBe('30ml');
    expect(result.shelfLifeMonths).toBe(36);
    expect(result.expiryDate).toBe('2028-05-31');
    expect(result.productionDate).toBe('2025-05-31');
    expect(result.category).toBe('精华');
  });

  test('extracts single expiry date (有效期至)', () => {
    const lines = ['品牌：兰蔻', '有效期至：2027-12-31', '保质期：36个月'];
    const result = extractProductInfo(lines);
    expect(result.expiryDate).toBe('2027-12-31');
    expect(result.shelfLifeMonths).toBe(36);
    expect(result.productionDate).toBe('2024-12-31');
  });

  // --- 产品名称回退提取测试（核心 bug 修复） ---

  test('extracts product name from brand-keyed line (YSL圣罗兰 精华液)', () => {
    // 当 OCR 输出格式为 "YSL圣罗兰 全新悦享青春夜间焕肤精华液" 时，
    // key 是品牌名而非 "产品名称"，需要回退识别
    const lines = [
      '品牌 YSL/圣罗兰',
      'YSL圣罗兰 全新悦享青春夜间焕肤精华液',
      '保质期 3年',
      '净含量 1瓶 30ml',
    ];
    const result = extractProductInfo(lines);
    expect(result.brand).toBe('YSL');
    expect(result.name).toBe('全新悦享青春夜间焕肤精华液');
  });

  test('extracts product name from standalone line with no key', () => {
    // OCR 输出中产品名称无 key 前缀，作为独立行出现
    const lines = [
      '品牌 YSL/圣罗兰',
      '全新悦享青春夜间焕肤精华液',
      '保质期 3年',
    ];
    const result = extractProductInfo(lines);
    expect(result.brand).toBe('YSL');
    expect(result.name).toBe('全新悦享青春夜间焕肤精华液');
  });

  test('extracts product name from standalone line removing brand prefix', () => {
    // 独立行中产品名称前有品牌名，应自动去除
    const lines = [
      '品牌 兰蔻',
      '兰蔻小黑瓶精华肌底液',
    ];
    const result = extractProductInfo(lines);
    expect(result.brand).toBe('兰蔻');
    expect(result.name).toBe('小黑瓶精华肌底液');
  });

  test('prefers explicit 产品名称 key over fallback', () => {
    // 显式 key 优先于回退提取
    const lines = [
      '品牌 YSL/圣罗兰',
      '产品名称 圣罗兰全新细管口红',
      'YSL圣罗兰 全新悦享青春夜间焕肤精华液',
    ];
    const result = extractProductInfo(lines);
    expect(result.name).toBe('圣罗兰全新细管口红');
  });

  test('simulates real OCR from YSL essence parameters page (image 2)', () => {
    // 模拟真实 OCR 扫描参数页的输出（无“产品名称”显式 key）
    const lines = [
      '品牌 YSL/圣罗兰',
      'YSL圣罗兰 全新悦享青春夜间焕肤精华液',
      '化妆品备案 国妆网备进字（沪）2023003022',
      '保质期 3年',
      '净含量 1瓶 30ml',
      '规格类型 正常规格',
      '生产厂家名称 Accredited Contract Packager',
      '质地 其他',
      '限期使用日期范围 2027-06-01至2028-05-31',
      '产地 法国',
      '是否为特殊用途化妆品 否',
      '包装数量 1支',
    ];
    const result = extractProductInfo(lines);
    expect(result.brand).toBe('YSL');
    expect(result.name).toBe('全新悦享青春夜间焕肤精华液');
    expect(result.specification).toBe('30ml');
    expect(result.category).toBe('精华');
    expect(result.shelfLifeMonths).toBe(36);
    expect(result.expiryDate).toBe('2028-05-31');
    expect(result.productionDate).toBe('2025-05-31');
  });

  test('handles buildLineMap with longer keys (>10 chars)', () => {
    // 确保 buildLineMap 支持超过 10 字符的 key
    const lines = [
      '化妆品备案编号/注册证号 国妆网备进字（沪）2025002277',
      '品牌 YSL/圣罗兰',
    ];
    const result = extractProductInfo(lines);
    expect(result.brand).toBe('YSL');
  });
});
