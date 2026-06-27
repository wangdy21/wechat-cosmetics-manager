/**
 * 小米 MiMo 多模态大模型调用模块
 * 使用 OpenAI 兼容 API 调用 MiMo 进行图片内容识别
 *
 * 部署前需在云函数环境变量中配置：
 *   MIMO_API_KEY - 小米 MiMo API Key
 *
 * 获取方式：https://platform.xiaomimimo.com/
 */
const https = require('https');

const ENDPOINT = 'https://api.xiaomimimo.com/v1/chat/completions';
const MODEL = 'mimo-v2.5';

/**
 * 调用 MiMo 识别化妆品图片
 * @param {Buffer} imageBuffer 图片二进制数据
 * @returns {Promise<{info: Object, rawContent: string}>} 结构化商品信息 + 原始响应
 */
function callMiMo(imageBuffer) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.MIMO_API_KEY;
    if (!apiKey) {
      reject(new Error('MiMo 未配置'));
      return;
    }

    const base64Image = imageBuffer.toString('base64');

    // MiMo 的 content 必须为字符串，图片以 Markdown 语法嵌入
    const userContent = USER_PROMPT + '\n\n![cosmetic](' + 'data:image/jpeg;base64,' + base64Image + ')';

    const payload = JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'developer',
          content: userContent,
        },
      ],
      temperature: 0.1,
      max_completion_tokens: 1024,
      thinking: { type: 'disabled' },
    });

    const url = new URL(ENDPOINT);
    console.log('[MiMo] Request URL:', ENDPOINT);
    console.log('[MiMo] Model:', MODEL);
    console.log('[MiMo] Image size (bytes):', imageBuffer.length);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      timeout: 30000,
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
    };
    console.log('[MiMo] Hostname:', url.hostname, 'Path:', url.pathname);

    const req = https.request(options, function (res) {
      let body = '';
      res.on('data', function (chunk) { body += chunk; });
      res.on('end', function () {
        console.log('[MiMo] HTTP status:', res.statusCode, 'body length:', body.length);

        if (res.statusCode === 401) {
          reject(new Error('识别服务暂时不可用'));
          return;
        }
        if (res.statusCode === 429) {
          reject(new Error('识别服务繁忙，请稍后重试'));
          return;
        }
        if (res.statusCode >= 500) {
          reject(new Error('识别服务暂时不可用'));
          return;
        }
        if (res.statusCode !== 200) {
          // 非标准状态码：记录完整响应体便于排查
          console.log('[MiMo] Unexpected status:', res.statusCode);
          console.log('[MiMo] Response body:', body);
          reject(new Error('MiMo HTTP ' + res.statusCode + ': ' + body.substring(0, 200)));
          return;
        }

        try {
          const json = JSON.parse(body);
          const content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
          if (!content) {
            reject(new Error('MiMo 返回内容为空'));
            return;
          }
          // 去除可能的 Markdown 代码块包裹
          const cleanContent = content
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          const parsed = JSON.parse(cleanContent);
          resolve({ info: parsed, rawContent: content });
        } catch (e) {
          reject(new Error('MiMo 响应解析失败: ' + e.message));
        }
      });
    });

    req.on('error', function (e) {
      reject(new Error('MiMo 请求失败: ' + e.message));
    });
    req.write(payload);
    req.end();
  });
}

const SYSTEM_PROMPT = '你是一个化妆品信息识别助手。用户会提供化妆品包装图片，请从图片中识别并提取以下信息。只返回 JSON，不要添加任何解释。如果某项无法从图片中识别，对应字段设为 null。';

const USER_PROMPT = '请从这张化妆品包装图片中提取以下信息，以 JSON 格式返回：\n' +
  '- brand: 品牌名称（如"兰蔻"、"雅诗兰黛"）\n' +
  '- name: 产品名称（如"小黑瓶精华肌底液"）\n' +
  '- specification: 净含量/规格（如"30ml"、"50g"）\n' +
  '- category: 产品分类，从以下列表中选择最匹配的一项：护肤、彩妆、美发、身体护理、香水、防晒、精华、面霜、化妆水、面膜、清洁、眼妆、底妆、口红、定妆、腮红修容、美甲、护发、身体护理、工具\n' +
  '- shelfLifeMonths: 保质期（以月为单位，如36；若包装标注"3年"则返回36；若未标注则为null）\n' +
  '- expiryDate: 限期使用日期/到期日期（格式 YYYY-MM-DD，若未标注则为null）\n' +
  '- productionDate: 生产日期（格式 YYYY-MM-DD），如果包装没有直接标注生产日期，但标注了到期日期和保质期，请根据到期日期减去保质期推算生产日期；若无法推算则为null';

module.exports = { callMiMo };
