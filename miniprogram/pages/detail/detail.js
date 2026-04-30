/**
 * 产品详情页逻辑
 * 查看产品信息、标记用完/丢弃、删除
 * 基于 expirationDate 实时计算展示状态
 */
const { calcRemainingDays, getProductDisplayStatus } = require('../../utils/date');
const { calcProgressPercent, formatRemainingText, getStatusColorClass } = require('../../utils/display');

Page({
  data: {
    product: null,
    loadError: '',
    remainingDaysAbs: 0,
    remainingUnit: '天',
    remainingText: '',
    colorClass: 'safe',
    progressPercent: 0,
    advanceDays: 30,
  },

  onLoad(options) {
    if (options.id) {
      this.productId = options.id;
      this.loadProduct(options.id);
    } else {
      this.setData({ loadError: '缺少产品 ID' });
    }
  },

  // --- 加载产品 ---
  loadProduct(id) {
    wx.cloud.callFunction({
      name: 'productOps',
      data: { action: 'get', _id: id },
    }).then((res) => {
      const result = (res && res.result) || {};
      if (!result.success) {
        this.setData({ loadError: result.error || '加载失败' });
        return;
      }

      const product = result.data;
      if (!product) {
        this.setData({ loadError: '产品不存在' });
        return;
      }
      this.setData({ product });
      this.updateDisplayStatus(product);
    }).catch(() => {
      this.setData({ loadError: '加载失败' });
    });
  },

  // --- 实时计算展示状态 ---
  updateDisplayStatus(product) {
    const remainingDays = calcRemainingDays(product.expirationDate);
    const displayStatus = (product.status === 'used_up' || product.status === 'discarded')
      ? product.status
      : getProductDisplayStatus(remainingDays, this.data.advanceDays);
    const progressPercent = calcProgressPercent(product.productionDate, product.expirationDate);

    this.setData({
      remainingDaysAbs: Math.abs(remainingDays),
      remainingUnit: remainingDays >= 0 ? '天' : '天前已过期',
      remainingText: formatRemainingText(remainingDays),
      colorClass: getStatusColorClass(displayStatus),
      progressPercent,
    });
  },

  // --- 标记用完 ---
  onMarkUsedUp() {
    this.updateStatus('used_up');
  },

  // --- 标记丢弃 ---
  onMarkDiscarded() {
    this.updateStatus('discarded');
  },

  updateStatus(status) {
    const label = status === 'used_up' ? '用完' : '丢弃';
    wx.showModal({
      title: '确认',
      content: `确定要标记为${label}吗？`,
      success: (res) => {
        if (!res.confirm) return;
        wx.cloud.callFunction({
          name: 'productOps',
          data: { action: 'updateStatus', _id: this.productId, status },
        }).then(() => {
          wx.showToast({ title: '已标记', icon: 'success' });
          this.loadProduct(this.productId);
        }).catch(() => {
          wx.showToast({ title: '操作失败', icon: 'none' });
        });
      },
    });
  },

  // --- 删除产品 ---
  onDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除吗？',
      confirmColor: '#F87171',
      success: (res) => {
        if (!res.confirm) return;
        wx.cloud.callFunction({
          name: 'productOps',
          data: { action: 'delete', _id: this.productId },
        }).then(() => {
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 800);
        }).catch(() => {
          wx.showToast({ title: '删除失败', icon: 'none' });
        });
      },
    });
  },
});
