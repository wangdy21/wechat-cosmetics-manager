/**
 * MiMo 调用模块测试
 * 测试 callMiMo 函数的请求构建、响应解析和错误处理
 */
const https = require('https');
const { callMiMo } = require('../cloudfunctions/productOps/mimo');

// 辅助：创建 mock 响应对象
function createMockResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    on: function (event, cb) {
      if (event === 'data') cb(body);
      if (event === 'end') cb();
      return this;
    },
  };
}

// 辅助：创建 mock 请求对象
function createMockReq(response) {
  return {
    on: function (event, cb) {
      if (event === 'error') { /* 不触发 */ }
      return this;
    },
    write: function () {},
    end: function () {
      // 模拟立即响应
      const resCb = https.request.mock.calls[https.request.mock.calls.length - 1][1];
      resCb(response);
    },
  };
}

describe('callMiMo', () => {
  beforeEach(() => {
    // 设置环境变量
    process.env.MIMO_API_KEY = 'test-api-key';
    // Mock https.request
    jest.spyOn(https, 'request').mockImplementation(function (options, callback) {
      return createMockReq(null); // 实际响应在 end() 中触发
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.MIMO_API_KEY;
  });

  // --- 正常流程 ---

  test('returns { info, rawContent } on successful response', async () => {
    const mockBody = JSON.stringify({
      choices: [{
        message: {
          content: '{"brand":"兰蔻","name":"小黑瓶精华肌底液","specification":"30ml","category":"精华","shelfLifeMonths":36,"expiryDate":"2027-06-01","productionDate":"2024-06-01"}',
        },
      }],
      usage: { total_tokens: 300 },
    });

    https.request.mockImplementation(function (options, callback) {
      const res = createMockResponse(200, mockBody);
      const req = {
        on: function () { return this; },
        write: function () {},
        end: function () { callback(res); },
      };
      return req;
    });

    const result = await callMiMo(Buffer.from('fake-image'));

    expect(result).toHaveProperty('info');
    expect(result).toHaveProperty('rawContent');
    expect(result.info.brand).toBe('兰蔻');
    expect(result.info.name).toBe('小黑瓶精华肌底液');
    expect(result.info.specification).toBe('30ml');
    expect(result.info.shelfLifeMonths).toBe(36);
  });

  // --- 请求体格式 ---

  test('constructs correct request body', async () => {
    let capturedPayload;

    https.request.mockImplementation(function (options, callback) {
      const req = {
        on: function () { return this; },
        write: function (data) { capturedPayload = data; },
        end: function () {
          const res = createMockResponse(200, JSON.stringify({
            choices: [{ message: { content: '{}' } }],
          }));
          callback(res);
        },
      };
      return req;
    });

    await callMiMo(Buffer.from('test-image'));

    const payload = JSON.parse(capturedPayload);
    expect(payload.model).toBe('mimo-v2.5');
    expect(payload.temperature).toBe(0.1);
    expect(payload.thinking).toEqual({ type: 'disabled' });
    expect(payload.max_completion_tokens).toBe(1024);
    expect(payload.messages[0].role).toBe('system');
    expect(payload.messages[1].role).toBe('user');
    // Vision API 格式：content 应为数组
    expect(Array.isArray(payload.messages[1].content)).toBe(true);
    expect(payload.messages[1].content[0].type).toBe('text');
    expect(payload.messages[1].content[0].text).toMatch(/^请从这张化妆品包装图片中提取以下信息/);
    expect(payload.messages[1].content[1].type).toBe('image_url');
    expect(payload.messages[1].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    // 新 prompt 应包含 packageDate 而非 expiryDate/productionDate
    expect(payload.messages[1].content[0].text).toMatch(/packageDate/);
    expect(payload.messages[1].content[0].text).not.toMatch(/expiryDate/);
  });

  // --- 请求选项 ---

  test('sets correct request options including timeout', async () => {
    let capturedOptions;

    https.request.mockImplementation(function (options, callback) {
      capturedOptions = options;
      const req = {
        on: function () { return this; },
        write: function () {},
        end: function () {
          const res = createMockResponse(200, JSON.stringify({
            choices: [{ message: { content: '{}' } }],
          }));
          callback(res);
        },
      };
      return req;
    });

    await callMiMo(Buffer.from('test'));

    expect(capturedOptions.hostname).toBe('api.xiaomimimo.com');
    expect(capturedOptions.path).toBe('/v1/chat/completions');
    expect(capturedOptions.method).toBe('POST');
    expect(capturedOptions.timeout).toBe(45000);
    expect(capturedOptions.headers['api-key']).toBe('test-api-key');
    expect(capturedOptions.headers['Content-Type']).toBe('application/json');
  });

  // --- Markdown 代码块包裹 ---

  test('strips Markdown code block wrapping from response', async () => {
    const rawJson = '{"brand":"YSL","name":"唇釉"}';
    const wrappedContent = '```json\n' + rawJson + '\n```';

    https.request.mockImplementation(function (options, callback) {
      const req = {
        on: function () { return this; },
        write: function () {},
        end: function () {
          const res = createMockResponse(200, JSON.stringify({
            choices: [{ message: { content: wrappedContent } }],
          }));
          callback(res);
        },
      };
      return req;
    });

    const result = await callMiMo(Buffer.from('test'));

    expect(result.info.brand).toBe('YSL');
    expect(result.info.name).toBe('唇釉');
    expect(result.rawContent).toBe(wrappedContent); // 原始内容保持不变
  });

  // --- HTTP 错误码 ---

  test('rejects on HTTP 401', async () => {
    https.request.mockImplementation(function (options, callback) {
      const req = {
        on: function () { return this; },
        write: function () {},
        end: function () { callback(createMockResponse(401, 'Unauthorized')); },
      };
      return req;
    });

    await expect(callMiMo(Buffer.from('test'))).rejects.toThrow('识别服务暂时不可用');
  });

  test('rejects on HTTP 429', async () => {
    https.request.mockImplementation(function (options, callback) {
      const req = {
        on: function () { return this; },
        write: function () {},
        end: function () { callback(createMockResponse(429, 'Rate limited')); },
      };
      return req;
    });

    await expect(callMiMo(Buffer.from('test'))).rejects.toThrow('识别服务繁忙，请稍后重试');
  });

  test('rejects on HTTP 500', async () => {
    https.request.mockImplementation(function (options, callback) {
      const req = {
        on: function () { return this; },
        write: function () {},
        end: function () { callback(createMockResponse(500, 'Server Error')); },
      };
      return req;
    });

    await expect(callMiMo(Buffer.from('test'))).rejects.toThrow('识别服务暂时不可用');
  });

  // --- API Key 未配置 ---

  test('rejects when MIMO_API_KEY is not set', async () => {
    delete process.env.MIMO_API_KEY;

    await expect(callMiMo(Buffer.from('test'))).rejects.toThrow('MiMo 未配置');
  });

  // --- 空 content ---

  test('rejects when response content is empty', async () => {
    https.request.mockImplementation(function (options, callback) {
      const req = {
        on: function () { return this; },
        write: function () {},
        end: function () {
          const res = createMockResponse(200, JSON.stringify({
            choices: [{ message: { content: '' } }],
          }));
          callback(res);
        },
      };
      return req;
    });

    await expect(callMiMo(Buffer.from('test'))).rejects.toThrow('MiMo 返回内容为空');
  });

  // --- JSON 解析失败 ---

  test('rejects when content is not valid JSON', async () => {
    https.request.mockImplementation(function (options, callback) {
      const req = {
        on: function () { return this; },
        write: function () {},
        end: function () {
          const res = createMockResponse(200, JSON.stringify({
            choices: [{ message: { content: 'not valid json {{' } }],
          }));
          callback(res);
        },
      };
      return req;
    });

    await expect(callMiMo(Buffer.from('test'))).rejects.toThrow('MiMo 响应解析失败');
  });

  // --- 网络错误 ---

  test('rejects on network error', async () => {
    https.request.mockImplementation(function (options, callback) {
      const req = {
        on: function (event, cb) {
          if (event === 'error') cb(new Error('ECONNREFUSED'));
          return this;
        },
        write: function () {},
        end: function () {},
      };
      return req;
    });

    await expect(callMiMo(Buffer.from('test'))).rejects.toThrow('MiMo 请求失败');
  });

  // --- 请求超时 ---

  test('rejects on request timeout', async () => {
    https.request.mockImplementation(function (options, callback) {
      const req = {
        on: function (event, cb) {
          if (event === 'timeout') cb();
          return this;
        },
        write: function () {},
        end: function () {},
        destroy: function () {},
      };
      return req;
    });

    await expect(callMiMo(Buffer.from('test'))).rejects.toThrow('MiMo 请求超时，请稍后重试');
  });

  // --- null 字段处理 ---

  test('preserves null fields from MiMo response', async () => {
    const content = '{"brand":null,"name":"某产品","specification":null,"category":null,"shelfLifeMonths":null,"expiryDate":null,"productionDate":null}';

    https.request.mockImplementation(function (options, callback) {
      const req = {
        on: function () { return this; },
        write: function () {},
        end: function () {
          const res = createMockResponse(200, JSON.stringify({
            choices: [{ message: { content: content } }],
          }));
          callback(res);
        },
      };
      return req;
    });

    const result = await callMiMo(Buffer.from('test'));

    expect(result.info.brand).toBeNull();
    expect(result.info.name).toBe('某产品');
    expect(result.info.shelfLifeMonths).toBeNull();
  });
});
