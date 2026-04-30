/**
 * 链接预处理工具
 * 职责：识别用户粘贴内容的类型，提取有效 URL 或淘口令
 * 实际解析由 parseLink 云函数完成
 */

// 链接类型匹配正则
const TAOBAO_LINK_RE = /https?:\/\/(?:item\.taobao|detail\.tmall)\.com\/item\.htm[^\s]*/;
const SHORT_LINK_RE = /https?:\/\/m\.tb\.cn\/[^\s]+/;
const TAOKOU_LING_RE = /[¥￥]([a-zA-Z0-9]+)[¥￥]/;

/**
 * 识别输入文本的链接类型
 * @param {string} text 用户粘贴的文本
 * @returns {'taobao_link'|'short_link'|'taokou_ling'|'unknown'}
 */
function identifyLinkType(text) {
  if (!text) return 'unknown';

  if (TAOBAO_LINK_RE.test(text)) return 'taobao_link';
  if (SHORT_LINK_RE.test(text)) return 'short_link';
  if (TAOKOU_LING_RE.test(text)) return 'taokou_ling';

  return 'unknown';
}

/**
 * 从文本中提取有效 URL 或淘口令代码
 * @param {string} text 原始文本
 * @param {string} type identifyLinkType 返回的类型
 * @returns {string|null} 提取的 URL 或淘口令代码
 */
function extractUrl(text, type) {
  if (!text) return null;

  if (type === 'taobao_link') {
    const match = text.match(TAOBAO_LINK_RE);
    return match ? match[0] : null;
  }

  if (type === 'short_link') {
    const match = text.match(SHORT_LINK_RE);
    return match ? match[0] : null;
  }

  if (type === 'taokou_ling') {
    const match = text.match(TAOKOU_LING_RE);
    return match ? match[1] : null;
  }

  return null;
}

/**
 * 解析用户输入，返回类型和提取值
 * @param {string} text 用户粘贴的文本
 * @returns {{ type: string, value: string|null }}
 */
function parseInput(text) {
  const type = identifyLinkType(text);
  const value = extractUrl(text, type);
  return { type, value };
}

module.exports = {
  identifyLinkType,
  extractUrl,
  parseInput,
};
