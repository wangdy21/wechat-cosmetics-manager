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
        return { error: '短链解析失败，请尝试直接复制商品详情页链接（如 item.taobao.com/item.htm?id=xxx）' };
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
 * 通过跟随 HTTP 重定向，从 *.tb.cn 短链还原为含 id 参数的商品链接
 */
async function resolveShortLink(shortUrl) {
  try {
    const resolvedUrl = await followRedirects(shortUrl, 5);
    return resolvedUrl;
  } catch {
    return null;
  }
}

/**
 * 递归跟随 HTTP 重定向（最多 maxRedirects 次）
 * 每步检查 URL 是否已包含 ?id= 参数；若是则直接返回
 * 非重定向响应则尝试从 HTML 中提取商品链接
 */
function followRedirects(url, maxRedirects) {
  return new Promise((resolve) => {
    if (maxRedirects <= 0) {
      resolve(null);
      return;
    }

    const https = require('https');
    const http = require('http');
    const mod = url.startsWith('https') ? https : http;

    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 8000,
    }, (res) => {
      // 检查 HTTP 重定向
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        let location = res.headers.location;
        // 处理相对 URL
        try {
          location = new URL(location, url).href;
        } catch {
          // location 已是绝对 URL，直接使用
        }
        // 如果重定向 URL 已包含商品 ID，直接返回
        if (/[?&]id=\d+/.test(location)) {
          resolve(location);
          return;
        }
        // 继续跟随重定向
        followRedirects(location, maxRedirects - 1).then(resolve);
        return;
      }

      // 非重定向响应 — 尝试从页面内容中提取商品链接
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        // 1. 从 HTML 中查找标准商品链接
        const urlMatch = data.match(/https?:\/\/(?:item\.taobao|detail\.tmall)\.com\/item\.htm[^"'\s<]*/);
        if (urlMatch) {
          resolve(urlMatch[0]);
          return;
        }
        // 2. 检查 meta refresh 重定向
        const metaMatch = data.match(/<meta[^>]*http-equiv=["']?refresh["']?[^>]*content=["']?\d+;\s*url=([^"'\s>]+)/i);
        if (metaMatch) {
          let metaUrl = metaMatch[1];
          try {
            metaUrl = new URL(metaUrl, url).href;
          } catch { /* use as-is */ }
          if (/[?&]id=\d+/.test(metaUrl)) {
            resolve(metaUrl);
            return;
          }
          followRedirects(metaUrl, maxRedirects - 1).then(resolve);
          return;
        }
        // 3. 检查 JavaScript location.href 跳转
        const jsMatch = data.match(/(?:location\.href|window\.location)\s*=\s*["']([^"']+)["']/i);
        if (jsMatch) {
          let jsUrl = jsMatch[1];
          try {
            jsUrl = new URL(jsUrl, url).href;
          } catch { /* use as-is */ }
          if (/[?&]id=\d+/.test(jsUrl)) {
            resolve(jsUrl);
            return;
          }
          followRedirects(jsUrl, maxRedirects - 1).then(resolve);
          return;
        }
        resolve(null);
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * 抓取商品页面标题
 * 多策略提取：嵌入 JSON → og:title → <title>，并过滤通用标题
 * 降级策略：H5 页面 → 桌面页面
 */
async function fetchItemTitle(url, itemId) {
  try {
    // 策略1：尝试淘宝 H5 页面（移动端）
    const h5Url = itemId
      ? `https://h5.m.taobao.com/awp/core/detail.htm?id=${itemId}`
      : url;

    const h5Result = await httpGetPage(h5Url);
    if (h5Result) {
      // 优先从嵌入的 JSON 数据中提取商品标题
      const jsonTitle = extractTitleFromJson(h5Result);
      if (jsonTitle && !isGenericTitle(jsonTitle)) {
        return jsonTitle;
      }
      // 其次从 og:title meta 标签提取
      const ogTitle = extractOgTitle(h5Result);
      if (ogTitle && !isGenericTitle(ogTitle)) {
        return ogTitle;
      }
      // 最后从 <title> 标签提取
      const tagTitle = extractTitleTag(h5Result);
      if (tagTitle && !isGenericTitle(tagTitle)) {
        return cleanTitle(tagTitle);
      }
    }

    // 策略2：尝试桌面端页面（标题通常更准确）
    if (itemId) {
      const desktopUrl = `https://item.taobao.com/item.htm?id=${itemId}`;
      const desktopResult = await httpGetPage(desktopUrl);
      if (desktopResult) {
        const jsonTitle = extractTitleFromJson(desktopResult);
        if (jsonTitle && !isGenericTitle(jsonTitle)) {
          return jsonTitle;
        }
        const ogTitle = extractOgTitle(desktopResult);
        if (ogTitle && !isGenericTitle(ogTitle)) {
          return ogTitle;
        }
        const tagTitle = extractTitleTag(desktopResult);
        if (tagTitle && !isGenericTitle(tagTitle)) {
          return cleanTitle(tagTitle);
        }
      }
    }

    // 策略3：如果有通用标题，清理后返回（优于完全无数据）
    if (h5Result) {
      const tagTitle = extractTitleTag(h5Result);
      if (tagTitle) {
        return cleanTitle(tagTitle);
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 发起 HTTP GET 请求，返回页面完整内容
 */
function httpGetPage(url) {
  const https = require('https');
  const http = require('http');
  const mod = url.startsWith('https') ? https : http;

  return new Promise((resolve) => {
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 5000,
    }, (res) => {
      // 处理重定向
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        let location = res.headers.location;
        try { location = new URL(location, url).href; } catch {}
        httpGetPage(location).then(resolve);
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data || null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * 从页面嵌入的 JSON 数据中提取商品标题
 * 匹配模式：window.__INITIAL_DATA__, g_config, itemDO, "title":"xxx"
 */
function extractTitleFromJson(html) {
  if (!html) return null;

  // 匹配 window.__INITIAL_DATA__ 或类似的全局变量
  const dataPatterns = [
    /window\.__INITIAL_DATA__\s*=\s*({[\s\S]*?});/,
    /window\.__DATA__\s*=\s*({[\s\S]*?});/,
    /g_config\s*=\s*({[\s\S]*?});/,
  ];
  for (const pat of dataPatterns) {
    const m = html.match(pat);
    if (m) {
      try {
        const obj = JSON.parse(m[1]);
      const title = deepFind(obj, ['title', 'itemTitle', 'itemName']);
      if (title && typeof title === 'string') return title.trim();
      } catch { /* not valid JSON, continue */ }
    }
  }

  // 匹配 itemDO.title 模式
  const itemDOMatch = html.match(/itemDO\s*[=:]\s*{[^}]*title\s*:\s*["']([^"']+)["']/);
  if (itemDOMatch) return itemDOMatch[1].trim();

  // 匹配 "title":"xxx" 模式（淘宝页面常见）
  const titleKeyMatch = html.match(/"title"\s*:\s*"([^"]{2,100})"/);
  if (titleKeyMatch && !isGenericTitle(titleKeyMatch[1])) {
    return titleKeyMatch[1].trim();
  }

  return null;
}

/**
 * 递归搜索对象中的指定 key，返回第一个非空字符串值
 */
function deepFind(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    if (obj[key] && typeof obj[key] === 'string') return obj[key];
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object') {
      const found = deepFind(val, keys);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 从 <meta property="og:title"> 提取标题
 */
function extractOgTitle(html) {
  if (!html) return null;
  const m = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (m) return m[1].trim();
  const m2 = html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  return m2 ? m2[1].trim() : null;
}

/**
 * 从 <title> 标签提取标题
 */
function extractTitleTag(html) {
  if (!html) return null;
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

/**
 * 判断是否为通用无意义标题
 */
function isGenericTitle(title) {
  if (!title) return true;
  const t = title.trim();
  const genericPatterns = [
    '商品详情', '商品详情页', 'detail', 'loading', '淘宝', '天猫',
    'tmall.com', 'taobao.com', '手机淘宝',
  ];
  const lower = t.toLowerCase();
  for (const p of genericPatterns) {
    if (lower === p.toLowerCase() || lower === p.toLowerCase() + '-') return true;
  }
  // 纯数字或极短标题
  if (/^\d+$/.test(t) || t.length < 2) return true;
  return false;
}

/**
 * 清理标题中的通用后缀/前缀
 */
function cleanTitle(title) {
  if (!title) return null;
  let t = title.trim();
  // 移除常见后缀
  const suffixes = ['-手机淘宝', '-淘宝', '—手机淘宝', '—淘宝', '-天猫', '—天猫',
    '-tmall.com', '-taobao.com', '—tmall.com', '—taobao.com',
    '_手机淘宝', '_淘宝', '|淘宝', '|天猫'];
  for (const s of suffixes) {
    if (t.endsWith(s)) {
      t = t.slice(0, -s.length).trim();
    }
  }
  return t || null;
}
