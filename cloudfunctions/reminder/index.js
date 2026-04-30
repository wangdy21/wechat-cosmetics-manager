/**
 * reminder 云函数
 * 定时触发器每天 08:00 执行
 * 1. 查询所有活跃产品（in_use / expiring_soon）
 * 2. 批量更新过期状态
 * 3. 对状态变更的产品发送订阅消息
 */
const cloud = require('wx-server-sdk');
const { classifyProducts } = require('./logic');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async () => {
  const now = new Date();

  try {
    // 1. 查询所有活跃产品
    const { data: rawProducts } = await db.collection('products')
      .where({
        status: _.in(['in_use', 'expiring_soon']),
      })
      .limit(1000)
      .get();

    const products = rawProducts
      .map((product) => ({
        ...product,
        _openid: product.ownerOpenid || product._openid,
      }))
      .filter((product) => !!product._openid);

    if (products.length === 0) {
      return { updated: 0, message: 'No active products' };
    }

    // 2. 查询所有用户的提醒设置
    const openids = [...new Set(products.map((p) => p._openid))];
    const { data: settingsArr } = await db.collection('reminder_settings')
      .where({
        _openid: _.in(openids),
      })
      .get();

    const settings = {};
    settingsArr.forEach((s) => {
      settings[s._openid] = s;
    });

    // 3. 分类产品
    const { toExpire, toExpiringSoon } = classifyProducts(products, settings, now);

    // 4. 批量更新状态
    let updatedCount = 0;
    const nowISO = now.toISOString();

    for (const item of toExpire) {
      await db.collection('products').doc(item._id).update({
        data: { status: 'expired', updatedAt: nowISO },
      });
      updatedCount++;
    }

    for (const item of toExpiringSoon) {
      await db.collection('products').doc(item._id).update({
        data: { status: 'expiring_soon', updatedAt: nowISO },
      });
      updatedCount++;
    }

    // 5. 发送订阅消息（对有推送权限的用户）
    const pushUsers = settingsArr.filter((s) => s.enablePush);
    for (const userSetting of pushUsers) {
      const userWarnings = [...toExpire, ...toExpiringSoon].filter(
        (item) => item._openid === userSetting._openid
      );

      if (userWarnings.length > 0) {
        try {
          await cloud.openapi.subscribeMessage.send({
            touser: userSetting._openid,
            templateId: 'TEMPLATE_ID_PLACEHOLDER', // 需在微信公众平台申请
            page: '/pages/home/home',
            data: {
              thing1: { value: `您有 ${userWarnings.length} 件产品需要注意` },
              time2: { value: now.toISOString().slice(0, 10) },
            },
          });
        } catch {
          // 订阅消息发送失败（可能授权已过期），静默忽略
        }
      }
    }

    return {
      updated: updatedCount,
      expired: toExpire.length,
      expiringSoon: toExpiringSoon.length,
      pushed: pushUsers.length,
    };
  } catch (err) {
    return { error: err.message };
  }
};
