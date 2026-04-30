/**
 * 首页仪表盘逻辑
 * 统计卡片 + 即将过期警告 + 最近添加
 * 基于 expirationDate 实时计算展示状态
 */
const { calcRemainingDays, getProductDisplayStatus, formatDate } = require('../../utils/date');
const { calcProgressPercent } = require('../../utils/display');

const ADVANCE_DAYS_DEFAULT = 30;

Page({
  data: {
    loading: false,
    stats: {
      inUse: 0,
      attention: 0,
      safeRate: 100,
    },
    warningProducts: [],
    recentProducts: [],
    advanceDays: ADVANCE_DAYS_DEFAULT,
  },

  onShow() {
    this.loadDashboard();
  },

  // --- 加载仪表盘数据 ---
  loadDashboard() {
    this.setData({ loading: true });

    // 获取所有非终态产品（排除 used_up、discarded）
    wx.cloud.callFunction({
      name: 'productOps',
      data: { action: 'list', pageSize: 200 },
    }).then((res) => {
      const result = (res && res.result) || {};
      if (!result.success) {
        this.setData({ loading: false });
        wx.showToast({ title: result.error || '加载失败', icon: 'none' });
        return;
      }

      const allProducts = (result.data && result.data.list) || [];
      const advanceDays = this.data.advanceDays;

      // 筛选活跃产品（非 used_up/discarded）
      const activeProducts = allProducts.filter(
        (p) => p.status !== 'used_up' && p.status !== 'discarded'
      );

      // 实时计算每个产品的展示状态
      let inUseCount = 0;
      let attentionCount = 0;
      const warnings = [];

      activeProducts.forEach((p) => {
        const remaining = calcRemainingDays(p.expirationDate);
        const displayStatus = getProductDisplayStatus(remaining, advanceDays);

        if (displayStatus === 'in_use') {
          inUseCount++;
        } else {
          attentionCount++;
          warnings.push({
            ...p,
            _remainingDays: remaining,
            _remainingAbs: Math.abs(remaining),
            _remainingLabel: remaining >= 0 ? '天后过期' : '天前已过期',
            _displayStatus: displayStatus,
            _progress: calcProgressPercent(p.productionDate, p.expirationDate),
          });
        }
      });

      // 排序：已过期在前，然后按剩余天数升序
      warnings.sort((a, b) => a._remainingDays - b._remainingDays);

      const total = inUseCount + attentionCount;
      const safeRate = total > 0 ? Math.round((inUseCount / total) * 100) : 100;

      // 最近添加（取最近5件，按创建时间倒序）
      const sorted = [...allProducts].sort(
        (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')
      );
      const recentProducts = sorted.slice(0, 5).map((p) => ({
        ...p,
        _addedDate: (p.createdAt || '').slice(0, 10),
      }));

      this.setData({
        loading: false,
        stats: { inUse: inUseCount, attention: attentionCount, safeRate },
        warningProducts: warnings,
        recentProducts,
      });
    }).catch(() => {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  // --- 跳转详情 ---
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  // --- 跳转库存 ---
  goInventory() {
    wx.switchTab({ url: '/pages/inventory/inventory' });
  },

  // --- 跳转添加 ---
  goAdd() {
    wx.switchTab({ url: '/pages/add/add' });
  },
});
