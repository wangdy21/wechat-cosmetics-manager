/**
 * parseLink 业务逻辑
 * 纯函数，不依赖 wx-server-sdk，可独立测试
 * 商品标题解析：品牌匹配、规格提取、分类推断
 */
const { matchBrand, extractSpecification } = require('./constants');

/**
 * 从淘宝/天猫链接中提取商品 ID
 * @param {string} url
 * @returns {string|null}
 */
function extractItemId(url) {
  if (!url) return null;
  const match = url.match(/[?&]id=(\d+)/);
  return match ? match[1] : null;
}

/**
 * 解析商品标题，提取品牌、规格、清洁名称
 * @param {string} title
 * @returns {{ name: string, brand: string, specification: string }}
 */
function parseProductTitle(title) {
  if (!title) return { name: '', brand: '', specification: '' };

  const brand = matchBrand(title) || '';
  const specification = extractSpecification(title) || '';

  // 从标题中移除品牌名，生成更干净的产品名
  let name = title;
  if (brand) {
    const idx = title.toLowerCase().indexOf(brand.toLowerCase());
    if (idx !== -1) {
      name = (title.slice(0, idx) + title.slice(idx + brand.length)).trim();
    }
  }

  // 清理名称中的多余空格
  name = name.replace(/\s+/g, ' ').trim();

  return { name: name || title, brand, specification };
}

// 分类关键词映射
const CATEGORY_KEYWORDS = {
  '护肤': ['精华', '面霜', '水乳', '乳液', '化妆水', '爽肤水', '面膜', '洁面', '卸妆', '防晒', '眼霜', '肌底液', '安瓶', '原液', '保湿', '补水', '抗皱', '美白'],
  '彩妆': ['口红', '唇釉', '唇膏', '粉底', '气垫', '眼影', '睫毛膏', '眼线', '腮红', '高光', '修容', '蜜粉', '散粉', '定妆', '遮瑕', '妆前', '哑光', '雾面'],
  '美发': ['洗发', '护发', '发膜', '染发', '造型', '发蜡', '发胶', '弹力素', '护发素'],
  '身体护理': ['身体乳', '沐浴', '护手霜', '磨砂', '脱毛', '止汗', '润肤', '身体霜'],
  '香水': ['香水', '香氛', '淡香', '浓香', 'EDT', 'EDP', '古龙'],
};

/**
 * 根据标题关键词推断分类
 * @param {string} title
 * @returns {string} 分类名或空字符串
 */
function inferCategory(title) {
  if (!title) return '';

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (title.includes(keyword)) {
        return category;
      }
    }
  }

  return '';
}

module.exports = {
  extractItemId,
  parseProductTitle,
  inferCategory,
};
