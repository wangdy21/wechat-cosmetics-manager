/**
 * 腾讯云 OCR 集成
 * 使用 TC3-HMAC-SHA256 签名调用腾讯云文字识别 API
 *
 * 部署前需在云函数环境变量中配置：
 *   OCR_SECRET_ID  - 腾讯云 SecretId
 *   OCR_SECRET_KEY - 腾讯云 SecretKey
 *
 * 注意：不能使用 TENCENTCLOUD_ 前缀，该前缀为 SCF 平台保留。
 * 在微信云开发控制台 → 云函数 → 环境变量 中添加。
 * 同时需确保该 SecretId/Key 对应的子账号已授权 QcloudOCRFullAccess 策略。
 */
const crypto = require('crypto');
const https = require('https');

const SERVICE = 'ocr';
const HOST = 'ocr.tencentcloudapi.com';
const ACTION = 'GeneralAccurateOCR';
const VERSION = '2018-11-19';

/**
 * HMAC-SHA256 签名
 */
function hmacSha256(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}

/**
 * SHA-256 哈希
 */
function sha256(msg) {
  return crypto.createHash('sha256').update(msg).digest('hex');
}

/**
 * 使用腾讯云 TC3 签名调用 OCR API
 * @param {Buffer} imageBuffer 图片二进制数据
 * @returns {Promise<string[]>} 识别出的文本行数组
 */
function callOCR(imageBuffer) {
  return new Promise((resolve, reject) => {
    // 凭据获取优先级：
    // 1. OCR_SECRET_ID / OCR_SECRET_KEY（用户手动配置，避免保留前缀冲突）
    // 2. TENCENTCLOUD_SECRETID / TENCENTCLOUD_SECRETKEY（SCF 运行时自动注入）
    const secretId = process.env.OCR_SECRET_ID || process.env.TENCENTCLOUD_SECRETID;
    const secretKey = process.env.OCR_SECRET_KEY || process.env.TENCENTCLOUD_SECRETKEY;

    if (!secretId || !secretKey) {
      reject(new Error('OCR 未配置：请在云函数环境变量中设置 OCR_SECRET_ID 和 OCR_SECRET_KEY'));
      return;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

    // 请求体
    const payload = JSON.stringify({
      ImageBase64: imageBuffer.toString('base64'),
    });

    // 1. 拼接规范请求串
    const httpRequestMethod = 'POST';
    const canonicalUri = '/';
    const canonicalQueryString = '';
    const canonicalHeaders =
      'content-type:application/json; charset=utf-8\n' +
      'host:' + HOST + '\n' +
      'x-tc-action:' + ACTION.toLowerCase() + '\n';
    const signedHeaders = 'content-type;host;x-tc-action';
    const hashedPayload = sha256(payload);
    const canonicalRequest = [
      httpRequestMethod,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      hashedPayload,
    ].join('\n');

    // 2. 拼接待签名字符串
    const algorithm = 'TC3-HMAC-SHA256';
    const credentialScope = date + '/' + SERVICE + '/tc3_request';
    const hashedCanonicalRequest = sha256(canonicalRequest);
    const stringToSign = [algorithm, timestamp, credentialScope, hashedCanonicalRequest].join('\n');

    // 3. 计算签名
    const secretDate = hmacSha256('TC3' + secretKey, date);
    const secretService = hmacSha256(secretDate, SERVICE);
    const secretSigning = hmacSha256(secretService, 'tc3_request');
    const signature = crypto
      .createHmac('sha256', secretSigning)
      .update(stringToSign)
      .digest('hex');

    // 4. 拼接 Authorization
    const authorization =
      algorithm +
      ' Credential=' + secretId + '/' + credentialScope +
      ', SignedHeaders=' + signedHeaders +
      ', Signature=' + signature;

    // 5. 发起 HTTPS 请求
    const options = {
      hostname: HOST,
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json; charset=utf-8',
        'Host': HOST,
        'X-TC-Action': ACTION,
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Version': VERSION,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        // 记录 HTTP 状态码便于调试
        console.log('[OCR] HTTP status:', res.statusCode, 'body length:', body.length);

        if (res.statusCode !== 200) {
          reject(new Error('OCR HTTP ' + res.statusCode + ': ' + body.substring(0, 200)));
          return;
        }

        let json;
        try {
          json = JSON.parse(body);
        } catch (e) {
          reject(new Error('OCR 响应非 JSON: ' + body.substring(0, 200)));
          return;
        }

        // API 返回错误
        if (json.Response && json.Response.Error) {
          const errMsg = json.Response.Error.Message;
          const errCode = json.Response.Error.Code;
          if (errCode === 'UnauthorizedOperation' || errMsg.indexOf('not authorized') !== -1) {
            reject(new Error(
              'OCR 权限不足：请确保 API 密钥对应的子账号已授权 QcloudOCRFullAccess 策略。' +
              '路径：腾讯云控制台 → 访问管理 → 用户 → 关联策略 → 搜索 OCR → 勾选 QcloudOCRFullAccess'
            ));
          } else {
            reject(new Error('OCR API 错误: ' + errMsg));
          }
          return;
        }

        // 解析识别结果
        try {
          const detections = (json.Response && json.Response.TextDetections) || [];
          if (detections.length === 0) {
            reject(new Error('未能从图片中识别到文字，请拍摄更清晰的商品包装'));
            return;
          }
          const lines = detections
            .sort((a, b) => {
              const ay = (a.ItemPolygon && a.ItemPolygon[0] && a.ItemPolygon[0].Y) || 0;
              const by = (b.ItemPolygon && b.ItemPolygon[0] && b.ItemPolygon[0].Y) || 0;
              return ay - by;
            })
            .map((d) => d.DetectedText || '')
            .filter((t) => t.length > 0);
          resolve(lines);
        } catch (e) {
          const snippet = JSON.stringify(json.Response).substring(0, 200);
          reject(new Error('OCR 结果解析失败: ' + e.message + ' | 原始: ' + snippet));
        }
      });
    });

    req.on('error', (e) => reject(new Error('OCR 请求失败: ' + e.message)));
    req.write(payload);
    req.end();
  });
}

module.exports = { callOCR };
