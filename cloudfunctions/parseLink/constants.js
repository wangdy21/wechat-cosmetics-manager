/**
 * 常量定义（云函数本地副本）
 * 原始文件：miniprogram/utils/constants.js
 * 注意：云函数部署时只上传函数目录内文件，无法跨目录引用
 * 分类完全由用户自定义，存储在云数据库 categories 集合中
 */

const PRODUCT_STATUS = {
  IN_USE: 'in_use',
  EXPIRING_SOON: 'expiring_soon',
  EXPIRED: 'expired',
  USED_UP: 'used_up',
  DISCARDED: 'discarded',
};

const BRAND_LIST = [
  // 国际高端
  'SK-II', '兰蔻', '雅诗兰黛', '迪奥', '香奈儿', '海蓝之谜', '赫莲娜',
  'CPB', '黛珂', 'POLA', '奥尔滨', '资生堂', '肌肤之钥',
  // 彩妆
  'MAC', 'YSL', 'NARS', 'TOM FORD', 'Armani', 'Givenchy', 'Guerlain',
  'Charlotte Tilbury', 'Pat McGrath', 'Bobbi Brown',
  // 中端
  '科颜氏', '倩碧', '悦木之源', '欧舒丹', 'LAMER', '娇韵诗',
  '伊丽莎白雅顿', '娇兰', '碧欧泉',
  // 日韩
  '后', '雪花秀', '悦诗风吟', 'innisfree', '兰芝', 'LANEIGE',
  '爱茉莉', 'AHC', '珂润', 'Curel', '芙丽芳丝', 'freeplus',
  'HABA', 'FANCL', 'DHC', '三熹玉', '3CE', 'CLIO',
  'CANMAKE', 'KATE', 'MAJOLICA', '恋爱魔镜', 'EXCEL',
  // 欧美平价
  '欧莱雅', '美宝莲', 'NYX', 'e.l.f.', 'Maybelline', "L'Oreal",
  'Revlon', 'CoverGirl', 'Wet n Wild', 'Milani',
  // 国货
  '花西子', '完美日记', '珀莱雅', '薇诺娜', '百雀羚', '自然堂',
  '韩束', '一叶子', '丸美', '相宜本草', '佰草集', '玉泽',
  '润百颜', '夸迪', '可复美', '敷尔佳', '毛戈平', 'COLORKEY',
  '橘朵', 'Judydoll', 'INTO YOU', 'HEDONE', 'ZEESEA', '滋色',
  // 功效护肤
  '修丽可', 'SkinCeuticals', '理肤泉', '薇姿', '雅漾', '贝德玛',
  'CeraVe', 'The Ordinary', '醉象', 'Drunk Elephant',
  'Paula\'s Choice', '宝拉珍选', 'Dr.Jart+', '蒂佳婷',
  // 身体护理/香水
  '欧舒丹', '祖玛珑', 'Jo Malone', '芦丹氏', 'Diptyque',
  'Byredo', 'Le Labo', '潘海利根', 'Penhaligon\'s',
  // 美发
  '卡诗', 'Kerastase', '施华蔻', 'Schwarzkopf', '沙宣', '潘婷',
  '吕', 'Ryo', 'OLAPLEX', 'Moroccanoil',
];

/**
 * 从商品标题中匹配品牌名
 * 优先匹配最长的品牌名
 * 英文品牌大小写不敏感
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
 * 从商品标题中提取规格信息
 * 匹配模式：数字（支持小数）+ 可选空格 + 单位 (ml/g/片/支/对)
 */
function extractSpecification(title) {
  if (!title) return null;

  const match = title.match(/(\d+\.?\d*)\s*(ml|ML|Ml|g|G|片|支|对)/);
  if (!match) return null;

  return match[1] + match[2].toLowerCase().replace('ml', 'ml').replace('g', 'g');
}

module.exports = {
  PRODUCT_STATUS,
  BRAND_LIST,
  matchBrand,
  extractSpecification,
};
