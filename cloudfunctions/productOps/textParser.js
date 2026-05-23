/**
 * OCR 文本解析器
 * 从 OCR 识别出的文本中提取商品关键信息
 * 注意：云函数独立部署，品牌词库和提取函数在此文件内自包含
 */

// 品牌词库（与 miniprogram/utils/constants.js 保持同步）
const BRAND_LIST = [
  'SK-II', '兰蔻', '雅诗兰黛', '迪奥', '香奈儿', '海蓝之谜', '赫莲娜',
  'CPB', '黛珂', 'POLA', '奥尔滨', '资生堂', '肌肤之钥',
  'MAC', 'YSL', 'NARS', 'TOM FORD', 'Armani', 'Givenchy', 'Guerlain',
  'Charlotte Tilbury', 'Pat McGrath', 'Bobbi Brown',
  '科颜氏', '倩碧', '悦木之源', '欧舒丹', 'LAMER', '娇韵诗',
  '伊丽莎白雅顿', '娇兰', '碧欧泉',
  '后', '雪花秀', '悦诗风吟', 'innisfree', '兰芝', 'LANEIGE',
  '爱茉莉', 'AHC', '珂润', 'Curel', '芙丽芳丝', 'freeplus',
  'HABA', 'FANCL', 'DHC', '三熹玉', '3CE', 'CLIO',
  'CANMAKE', 'KATE', 'MAJOLICA', '恋爱魔镜', 'EXCEL',
  '欧莱雅', '美宝莲', 'NYX', 'e.l.f.', 'Maybelline', "L'Oreal",
  'Revlon', 'CoverGirl', 'Wet n Wild', 'Milani',
  '花西子', '完美日记', '珀莱雅', '薇诺娜', '百雀羚', '自然堂',
  '韩束', '一叶子', '丸美', '相宜本草', '佰草集', '玉泽',
  '润百颜', '夸迪', '可复美', '敷尔佳', '毛戈平', 'COLORKEY',
  '橘朵', 'Judydoll', 'INTO YOU', 'HEDONE', 'ZEESEA', '滋色',
  '修丽可', 'SkinCeuticals', '理肤泉', '薇姿', '雅漾', '贝德玛',
  'CeraVe', 'The Ordinary', '醉象', 'Drunk Elephant',
  "Paula's Choice", '宝拉珍选', 'Dr.Jart+', '蒂佳婷',
  '祖玛珑', 'Jo Malone', '芦丹氏', 'Diptyque',
  'Byredo', 'Le Labo', '潘海利根', "Penhaligon's",
  '卡诗', 'Kerastase', '施华蔻', 'Schwarzkopf', '沙宣', '潘婷',
  '吕', 'Ryo', 'OLAPLEX', 'Moroccanoil',
];

/**
 * 从文本中匹配品牌名（优先最长匹配）
 */
function matchBrand(title) {
  if (!title) return null;
  let bestMatch = null;
  let bestLength = 0;
  for (const brand of BRAND_LIST) {
    const idx = title.toLowerCase().indexOf(brand.toLowerCase());
    if (idx !== -1 && brand.length > bestLength) {
      bestMatch = brand;
      bestLength = brand.length;
    }
  }
  return bestMatch;
}

/**
 * 从文本中提取规格（数字+单位，支持小数）
 */
function extractSpecification(title) {
  if (!title) return null;
  const match = title.match(/(\d+\.?\d*)\s*(ml|ML|Ml|g|G|片|支|对)/);
  if (!match) return null;
  return match[1] + match[2].toLowerCase().replace('ml', 'ml').replace('g', 'g');
}

// 产品名称指示词（用于无 key 前缀的回退识别）
const PRODUCT_NAME_INDICATORS = [
  '精华液', '精华', '面霜', '乳液', '口红', '唇膏', '唇釉', '唇彩',
  '粉底', '气垫', '眼影', '眼线', '睫毛膏', '眉笔',
  '防晒', '隔离', '化妆水', '爽肤水', '面膜', '洁面',
  '卸妆', '香水', '散粉', '蜜粉', '修容', '高光',
  '腮红', '遮瑕', '身体乳', '护手霜', '洗发水', '护发素',
  '柔肤水', '收敛水', '精华水', '日霜', '晚霜', '粉饼',
  '定妆', '甲油', '发膜', '沐浴', '卸妆油', '卸妆水',
];

/**
 * 判断文本是否看起来像化妆品产品名称
 */
function looksLikeProductName(text) {
  if (!text || text.length < 3) return false;
  for (const indicator of PRODUCT_NAME_INDICATORS) {
    if (text.indexOf(indicator) !== -1) return true;
  }
  return false;
}

// 分类关键词映射
const CATEGORY_KEYWORDS = [
  { keywords: ['口红', '唇膏', '唇釉', '唇彩', '唇线笔'], category: '口红' },
  { keywords: ['粉底', '气垫', 'BB霜', 'CC霜', '遮瑕'], category: '底妆' },
  { keywords: ['眼影', '眼线', '睫毛膏', '眉笔', '睫毛'], category: '眼妆' },
  { keywords: ['精华', '精华液', '肌底液', '安瓶', '原液'], category: '精华' },
  { keywords: ['面霜', '乳液', '乳霜', '保湿霜', '日霜', '晚霜'], category: '面霜' },
  { keywords: ['爽肤水', '化妆水', '柔肤水', '精华水', '收敛水'], category: '化妆水' },
  { keywords: ['防晒', '防晒霜', '防晒乳', '防晒喷雾', '隔离'], category: '防晒' },
  { keywords: ['面膜', '贴片', '涂抹面膜'], category: '面膜' },
  { keywords: ['洗面奶', '洁面', '卸妆', '卸妆油', '卸妆水'], category: '清洁' },
  { keywords: ['香水', '淡香水', '浓香水', '香氛'], category: '香水' },
  { keywords: ['散粉', '蜜粉', '粉饼', '定妆'], category: '定妆' },
  { keywords: ['腮红', '修容', '高光', '阴影'], category: '腮红修容' },
  { keywords: ['指甲油', '美甲', '甲油'], category: '美甲' },
  { keywords: ['护发', '洗发水', '护发素', '发膜', '精油'], category: '护发' },
  { keywords: ['身体乳', '沐浴', '身体护理', '护手霜'], category: '身体护理' },
];

// 规格提取正则（支持小数）
const SPEC_RE = /(\d+\.?\d*)\s*(ml|ML|g|G|片|支|对|g\/ml|ml\/g)/i;

// 净含量提取正则
const NET_CONTENT_RE = /净含量[：:\s]*(\d+\.?\d*)\s*(ml|ML|g|G|片|支|对)/i;

// 保质期提取正则（支持"3年"、"36个月"、"36月"）
const SHELF_LIFE_RE = /保质期[：:\s]*(\d+)\s*(年|个月|月)/i;

// 限期使用日期范围提取正则（如"2027-06-01 至 2028-05-31"）
const EXPIRY_RANGE_RE = /限期使用日期范围[：:\s]*(\d{4}-\d{2}-\d{2})\s*[至到]\s*(\d{4}-\d{2}-\d{2})/i;

// 单个到期日期提取正则
const EXPIRY_DATE_RE = /(有效期至|使用期限|到期日期|过期日期)[：:\s]*(\d{4}-\d{2}-\d{2})/i;

/**
 * 从 OCR 文本行中提取商品信息
 * @param {string[]} lines OCR 识别出的文本行数组
 * @returns {{ brand: string, name: string, specification: string, category: string, shelfLifeMonths: number|null, expiryDate: string|null, productionDate: string|null }}
 */
function extractProductInfo(lines) {
  if (!lines || lines.length === 0) {
    return { brand: '', name: '', specification: '', category: '', shelfLifeMonths: null, expiryDate: null, productionDate: null };
  }

  const fullText = lines.join(' ');
  const lineMap = buildLineMap(lines);

  const result = {
    brand: '',
    name: '',
    specification: '',
    category: '',
    shelfLifeMonths: null,
    expiryDate: null,
    productionDate: null,
  };

  // --- 提取品牌 ---
  // 优先从 key-value 对中提取
  const brandKV = findValueForKey(lineMap, ['品牌']);
  if (brandKV) {
    // 清理品牌值，如 "YSL/圣罗兰" → 保留原样
    result.brand = brandKV.replace(/[/／].+/, '').trim() || brandKV.trim();
  }
  // 回退到品牌词库匹配
  if (!result.brand) {
    const matched = matchBrand(fullText);
    if (matched) result.brand = matched;
  }

  // --- 提取产品名称 ---
  let nameKV = findValueForKey(lineMap, ['产品名称', '品名', '商品名称', '单品']);
  if (nameKV) {
    // 如果名称以品牌开头，去除品牌前缀
    if (result.brand) {
      const brandLower = result.brand.toLowerCase();
      const nameLower = nameKV.toLowerCase();
      if (nameLower.startsWith(brandLower)) {
        nameKV = nameKV.substring(result.brand.length).trim();
      }
      // 也尝试去除中文品牌名（如"圣罗兰"）
      const chineseBrandMatch = nameKV.match(/^[\u4e00-\u9fff]{2,4}/);
      if (chineseBrandMatch && matchBrand(chineseBrandMatch[0])) {
        nameKV = nameKV.substring(chineseBrandMatch[0].length).trim();
      }
    }
    result.name = nameKV;
  }

  // --- 回退：从品牌名为 key 的行中提取产品名称 ---
  // 当 OCR 输出格式为 "YSL圣罗兰 全新悦享青春夜间焕肤精华液" 时，
  // key 是品牌名而非 "产品名称"，需要回退识别
  if (!result.name) {
    for (const entry of lineMap) {
      if (entry.key && entry.value && matchBrand(entry.key) && looksLikeProductName(entry.value)) {
        let name = entry.value;
        // 去除品牌前缀
        if (result.brand) {
          const brandLower = result.brand.toLowerCase();
          const nameLower = name.toLowerCase();
          if (nameLower.startsWith(brandLower)) {
            name = name.substring(result.brand.length).trim();
          }
          const chineseBrandMatch = name.match(/^[\u4e00-\u9fff]{2,4}/);
          if (chineseBrandMatch && matchBrand(chineseBrandMatch[0])) {
            name = name.substring(chineseBrandMatch[0].length).trim();
          }
        }
        if (name) result.name = name;
        break;
      }
    }
  }

  // --- 回退：从无 key 的独立行中提取产品名称 ---
  // OCR 可能识别出单独一行的产品名称，无任何 key 前缀
  if (!result.name) {
    for (const entry of lineMap) {
      if (!entry.key && entry.value && looksLikeProductName(entry.value)) {
        let name = entry.value;
        // 去除品牌前缀
        if (result.brand) {
          const brandLower = result.brand.toLowerCase();
          const nameLower = name.toLowerCase();
          if (nameLower.startsWith(brandLower)) {
            name = name.substring(result.brand.length).trim();
          }
          const chineseBrandMatch = name.match(/^[\u4e00-\u9fff]{2,4}/);
          if (chineseBrandMatch && matchBrand(chineseBrandMatch[0])) {
            name = name.substring(chineseBrandMatch[0].length).trim();
          }
        }
        if (name) result.name = name;
        break;
      }
    }
  }

  // --- 提取规格 ---
  // 优先从 key-value 对中提取净含量
  const specKV = findValueForKey(lineMap, ['净含量', '规格', '容量']);
  if (specKV) {
    const specMatch = specKV.match(SPEC_RE);
    if (specMatch) {
      result.specification = specMatch[1] + specMatch[2].toLowerCase();
    } else {
      result.specification = specKV;
    }
  }
  // 回退到正则匹配
  if (!result.specification) {
    // 优先匹配净含量
    const netMatch = fullText.match(NET_CONTENT_RE);
    if (netMatch) {
      result.specification = netMatch[1] + netMatch[2].toLowerCase();
    } else {
      const extracted = extractSpecification(fullText);
      if (extracted) result.specification = extracted;
    }
  }

  // --- 提取分类 ---
  const categoryKV = findValueForKey(lineMap, ['产品类别', '分类', '类别']);
  if (categoryKV) {
    // 尝试匹配已知分类
    for (const entry of CATEGORY_KEYWORDS) {
      for (const kw of entry.keywords) {
        if (categoryKV.indexOf(kw) !== -1) {
          result.category = entry.category;
          break;
        }
      }
      if (result.category) break;
    }
  }
  // 回退到全文关键词匹配
  if (!result.category) {
    for (const entry of CATEGORY_KEYWORDS) {
      for (const kw of entry.keywords) {
        if (fullText.indexOf(kw) !== -1) {
          result.category = entry.category;
          break;
        }
      }
      if (result.category) break;
    }
  }

  // --- 提取保质期（月数） ---
  const shelfLifeKV = findValueForKey(lineMap, ['保质期']);
  if (shelfLifeKV) {
    const shelfMatch = shelfLifeKV.match(SHELF_LIFE_RE);
    if (shelfMatch) {
      const value = parseInt(shelfMatch[1], 10);
      const unit = shelfMatch[2].toLowerCase();
      result.shelfLifeMonths = unit === '年' ? value * 12 : value;
    }
  }
  // 回退到全文正则匹配
  if (result.shelfLifeMonths === null) {
    const shelfMatch = fullText.match(SHELF_LIFE_RE);
    if (shelfMatch) {
      const value = parseInt(shelfMatch[1], 10);
      const unit = shelfMatch[2].toLowerCase();
      result.shelfLifeMonths = unit === '年' ? value * 12 : value;
    }
  }

  // --- 提取限期使用日期 ---
  // 日期范围正则（不含 key 前缀，用于匹配 value 部分）
  const DATE_RANGE_RE = /(\d{4}-\d{2}-\d{2})\s*[至到]\s*(\d{4}-\d{2}-\d{2})/;
  const SINGLE_DATE_RE = /(\d{4}-\d{2}-\d{2})/;

  const expiryKV = findValueForKey(lineMap, ['限期使用日期范围', '限期使用日期', '有效期至', '使用期限', '到期日期', '过期日期']);
  if (expiryKV) {
    // 尝试匹配日期范围（如 "2027-06-01 至 2028-05-31"）
    const rangeMatch = expiryKV.match(DATE_RANGE_RE);
    if (rangeMatch) {
      result.expiryDate = rangeMatch[2]; // 使用结束日期
    } else {
      // 尝试匹配单个日期
      const dateMatch = expiryKV.match(SINGLE_DATE_RE);
      if (dateMatch) {
        result.expiryDate = dateMatch[1];
      }
    }
  }
  // 回退到全文正则匹配
  if (!result.expiryDate) {
    const rangeMatch = fullText.match(EXPIRY_RANGE_RE);
    if (rangeMatch) {
      result.expiryDate = rangeMatch[2];
    } else {
      const dateMatch = fullText.match(EXPIRY_DATE_RE);
      if (dateMatch) {
        result.expiryDate = dateMatch[2];
      }
    }
  }

  // --- 根据到期日期和保质期反推生产日期 ---
  if (result.expiryDate && result.shelfLifeMonths) {
    try {
      const expiryDateObj = new Date(result.expiryDate);
      if (!isNaN(expiryDateObj.getTime())) {
        const productionDateObj = new Date(expiryDateObj);
        productionDateObj.setMonth(productionDateObj.getMonth() - result.shelfLifeMonths);
        const year = productionDateObj.getFullYear();
        const month = String(productionDateObj.getMonth() + 1).padStart(2, '0');
        const day = String(productionDateObj.getDate()).padStart(2, '0');
        result.productionDate = `${year}-${month}-${day}`;
      }
    } catch (e) {
      // 忽略日期计算错误
    }
  }

  return result;
}

/**
 * 构建 key-value 行映射
 * 支持格式："品牌：YSL" / "品牌 YSL/圣罗兰"（冒号或空格分隔）
 */
function buildLineMap(lines) {
  const map = [];
  for (const line of lines) {
    // 优先匹配 "key：value" 或 "key: value"
    const colonMatch = line.match(/^(.+?)[：:]\s*(.+)$/);
    if (colonMatch) {
      map.push({ key: colonMatch[1].trim(), value: colonMatch[2].trim() });
      continue;
    }
    // 匹配 "key value"（空格分隔，key 为中文标签，长度不超过15）
    const spaceMatch = line.match(/^([\u4e00-\u9fff/A-Za-z()（）\d]{2,15})\s+(.+)$/);
    if (spaceMatch) {
      map.push({ key: spaceMatch[1].trim(), value: spaceMatch[2].trim() });
      continue;
    }
    map.push({ key: '', value: line.trim() });
  }
  return map;
}

/**
 * 在行映射中查找匹配 key 的 value
 * 按 keys 的优先级顺序匹配（keys[0] 优先级最高）
 * @param {Array<{key:string, value:string}>} lineMap
 * @param {string[]} keys 要查找的 key 关键词列表（按优先级排列）
 * @returns {string|null}
 */
function findValueForKey(lineMap, keys) {
  // 按 keys 优先级遍历
  for (const key of keys) {
    for (const entry of lineMap) {
      if (entry.key && entry.key.indexOf(key) !== -1 && entry.value) {
        return entry.value;
      }
    }
  }
  return null;
}

module.exports = { extractProductInfo };
