/**
 * 分类管理页逻辑
 * 完全用户自定义：查看、添加、删除分类
 * 数据存储于云数据库 categories 集合，通过 productOps 云函数操作（绕过客户端安全规则限制）
 */

/**
 * 解析云数据库操作错误，返回用户可读的提示
 */
function parseDbError(err) {
  const errMsg = (err && (err.errMsg || err.message)) || '';
  const errCode = err && err.errCode;
  console.error('[category] 数据库操作失败', { errCode, errMsg, err });

  if (errMsg.indexOf('-502005') !== -1 || errMsg.indexOf('not exists') !== -1) {
    return '集合 categories 不存在，请在云开发控制台创建';
  }
  if (errMsg.indexOf('-502001') !== -1 || errMsg.indexOf('permission denied') !== -1) {
    return '无权写入，请检查数据库安全规则';
  }
  if (errMsg.indexOf('-601034') !== -1 || errMsg.indexOf('没有权限') !== -1) {
    return '云开发未配置，请先开通云开发';
  }
  if (errMsg.toLowerCase().indexOf('timeout') !== -1) {
    return '网络超时，请重试';
  }
  return errMsg || '操作失败';
}

Page({
  data: {
    customCategories: [],
    loading: false,
  },

  onShow() {
    this.loadCustomCategories();
  },

  // --- 加载自定义分类 ---
  loadCustomCategories() {
    this.setData({ loading: true });
    wx.cloud.callFunction({
      name: 'productOps',
      data: { action: 'categoryList' },
    }).then((res) => {
      const result = (res && res.result) || {};
      this.setData({
        customCategories: result.data || [],
        loading: false,
      });
    }).catch((err) => {
      this.setData({ loading: false });
      wx.showToast({ title: parseDbError(err), icon: 'none', duration: 3000 });
    });
  },

  // --- 添加自定义分类 ---
  onAddCategory() {
    wx.showModal({
      title: '添加分类',
      editable: true,
      placeholderText: '输入分类名称',
      success: (res) => {
        if (!res.confirm || !res.content || !res.content.trim()) return;

        const name = res.content.trim();

        // 长度限制
        if (name.length > 20) {
          wx.showToast({ title: '分类名称不能超过 20 个字符', icon: 'none' });
          return;
        }

        // 检查是否与已有分类重名
        if (this.data.customCategories.find((c) => c.name === name)) {
          wx.showToast({ title: '分类已存在', icon: 'none' });
          return;
        }

        wx.showLoading({ title: '添加中...', mask: true });
        wx.cloud.callFunction({
          name: 'productOps',
          data: { action: 'categoryAdd', name },
        }).then((cfRes) => {
          wx.hideLoading();
          const result = (cfRes && cfRes.result) || {};
          if (result.success) {
            wx.showToast({ title: '添加成功', icon: 'success' });
            this.loadCustomCategories();
          } else {
            wx.showModal({
              title: '添加失败',
              content: result.error || '操作失败',
              showCancel: false,
            });
          }
        }).catch((err) => {
          wx.hideLoading();
          wx.showModal({
            title: '添加失败',
            content: parseDbError(err),
            showCancel: false,
          });
        });
      },
    });
  },

  // --- 删除自定义分类 ---
  onDeleteCategory(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: `确定要删除分类"${name}"吗？`,
      confirmColor: '#F87171',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中...', mask: true });
        wx.cloud.callFunction({
          name: 'productOps',
          data: { action: 'categoryDelete', _id: id },
        }).then((cfRes) => {
          wx.hideLoading();
          const result = (cfRes && cfRes.result) || {};
          if (result.success) {
            wx.showToast({ title: '已删除', icon: 'success' });
            this.loadCustomCategories();
          } else {
            wx.showToast({ title: result.error || '删除失败', icon: 'none', duration: 3000 });
          }
        }).catch((err) => {
          wx.hideLoading();
          wx.showToast({ title: parseDbError(err), icon: 'none', duration: 3000 });
        });
      },
    });
  },
});
