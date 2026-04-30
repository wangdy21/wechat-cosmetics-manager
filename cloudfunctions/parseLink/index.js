/**
 * parseLink 云函数
 * 淘宝/天猫商品链接解析
 * 降级策略：API → 页面抓取 → 标题解析
 */
const cloud = require('wx-server-sdk');
const { extractItemId, parseProductTitle, inferCategory } = require('./logic');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { type, value } = event;

  if (!type || !value) {
    return { error: '缺少必要参数' };
  }

  try {
    let url = value;

    // 短链和淘口令：需要解析为真实链接
    if (type === 'short_link') {
      url = await resolveShortLink(value);
      if (!url) {
        return { error: '短链解析失败' };
      }
    } else if (type === 'taokou_ling') {
      // 淘口令解析需要淘宝开放平台 API
      // 当前作为降级方案返回提示
      return { error: '淘口令解析暂不支持，请复制商品链接' };
    }

    // 提取商品 ID
    const itemId = extractItemId(url);

    // 尝试抓取商品页面标题
    const title = await fetchItemTitle(url, itemId);
    if (!title) {
      return { error: '无法获取商品信息' };
    }

    // 解析标题
    const parsed = parseProductTitle(title);
    const category = inferCategory(title);

    return {
      name: parsed.name,
      brand: parsed.brand,
      specification: parsed.specification,
      category,
      imageUrl: '',
    };
  } catch (err) {
    return { error: '解析失败: ' + (err.message || '未知错误') };
  }
};

/**
 * 解析短链获取真实 URL
 */
async function resolveShortLink(shortUrl) {
  try {
    const res = await cloud.callContainer({
      // 使用云托管或外部 HTTP 请求跟随重定向
      // 降级方案：直接返回 null
    });
    return res || null;
  } catch {
    return null;
  }
}

/**
 * 抓取商品页面标题
 * 降级策略：尝试 HTTP 请求获取页面 <title>
 */
async function fetchItemTitle(url, itemId) {
  try {
    // 方案1：尝试淘宝 H5 页面
    const h5Url = itemId
      ? `https://h5.m.taobao.com/awp/core/detail.htm?id=${itemId}`
      : url;

    // 在云函数环境中发起 HTTP 请求
    const http = require('http');
    const https = require('https');
    const fetchModule = h5Url.startsWith('https') ? https : http;

    return new Promise((resolve) => {
      const req = fetchModule.get(h5Url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
        },
        timeout: 5000,
      }, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          // 从 HTML 中提取 title
          const titleMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i);
          resolve(titleMatch ? titleMatch[1].trim() : null);
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  } catch {
    return null;
  }
}
