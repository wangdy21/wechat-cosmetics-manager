/**
 * 个人中心页逻辑
 * 库存统计、提醒设置、分类管理入口
 */
const { PRESET_CATEGORIES } = require('../../utils/constants');

Page({
  data: {
    totalProducts: 0,
    categoryStats: [],
    advanceDays: 30,
    enablePush: false,
    pushFrequency: 'daily',
  },

  onShow() {
    this.loadStats();
    this.loadSettings();
  },

  // --- 加载库存统计 ---
  loadStats() {
    wx.cloud.callFunction({
      name: 'productOps',
      data: { action: 'list', pageSize: 500 },
    }).then((res) => {
      const result = (res && res.result) || {};
      if (!result.success) {
        wx.showToast({ title: result.error || '加载失败', icon: 'none' });
        return;
      }

      const products = (result.data && result.data.list) || [];
      const total = products.length;

      // 按分类统计
      const countMap = {};
      products.forEach((p) => {
        countMap[p.category] = (countMap[p.category] || 0) + 1;
      });

      const categoryStats = PRESET_CATEGORIES
        .map((c) => ({ name: c.name, count: countMap[c.name] || 0 }))
        .filter((c) => c.count > 0);

      // 添加不在预设中的自定义分类
      Object.keys(countMap).forEach((cat) => {
        if (!PRESET_CATEGORIES.find((c) => c.name === cat)) {
          categoryStats.push({ name: cat, count: countMap[cat] });
        }
      });

      this.setData({ totalProducts: total, categoryStats });
    });
  },

  // --- 加载提醒设置 ---
  loadSettings() {
    const db = wx.cloud.database();
    db.collection('reminder_settings')
      .where({ _openid: '{openid}' })
      .limit(1)
      .get()
      .then((res) => {
        if (res.data && res.data.length > 0) {
          const s = res.data[0];
          this.setData({
            advanceDays: s.advanceDays || 30,
            enablePush: s.enablePush || false,
            pushFrequency: s.pushFrequency || 'daily',
          });
        }
      });
  },

  // --- 推送开关 ---
  onPushToggle(e) {
    const enablePush = e.detail.value;
    this.setData({ enablePush });
    this.saveSettings({ enablePush });
  },

  // --- 保存设置 ---
  saveSettings(updates) {
    const db = wx.cloud.database();
    db.collection('reminder_settings')
      .where({ _openid: '{openid}' })
      .limit(1)
      .get()
      .then((res) => {
        if (res.data && res.data.length > 0) {
          db.collection('reminder_settings')
            .doc(res.data[0]._id)
            .update({ data: updates });
        } else {
          db.collection('reminder_settings').add({
            data: {
              advanceDays: this.data.advanceDays,
              enablePush: this.data.enablePush,
              pushFrequency: this.data.pushFrequency,
              ...updates,
            },
          });
        }
      });
  },

  // --- 跳转分类管理 ---
  goCategory() {
    wx.navigateTo({ url: '/pages/category/category' });
  },
});
