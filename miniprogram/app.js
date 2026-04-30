/**
 * CosmeticBox 小程序入口
 *
 * 使用前请完成以下配置：
 * 1. 在 project.config.json 中填入真实的 appid
 * 2. 在微信开发者工具中开通云开发，创建云环境
 * 3. 将下方 ENV_ID 替换为你的云环境 ID
 */

// TODO: 替换为你的云开发环境 ID（在微信开发者工具 → 云开发控制台中获取）
const ENV_ID = 'cloud1-5gxed6ae2f784226';

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }

    const initConfig = { traceUser: true };
    if (ENV_ID) {
      initConfig.env = ENV_ID;
    }

    wx.cloud.init(initConfig);
  },

  globalData: {
    userInfo: null,
  },
});
