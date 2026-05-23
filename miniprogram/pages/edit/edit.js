/**
 * 编辑产品页逻辑
 * 从详情页传入产品 ID，加载现有数据并允许修改
 * 对接 productOps 云函数 update 操作
 */
const { calcExpirationDate, formatDate } = require('../../utils/date');

Page({
  data: {
    productId: '',
    saving: false,
    showOpened: false,
    today: '',
    expiryPreview: '',
    categories: [],
    form: {
      brand: '',
      name: '',
      category: '',
      specification: '',
      productionDate: '',
      shelfLifeMonths: '',
      openedDate: '',
      openedShelfLifeMonths: '',
    },
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({ title: '缺少产品ID', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ productId: options.id, today: formatDate(new Date()) });
    this.loadProduct(options.id);
    this.loadCategories();
  },

  // --- 加载产品数据填充表单 ---
  loadProduct(id) {
    wx.cloud.callFunction({
      name: 'productOps',
      data: { action: 'get', _id: id },
    }).then((res) => {
      const result = (res && res.result) || {};
      if (!result.success) {
        wx.showToast({ title: result.error || '加载失败', icon: 'none' });
        return;
      }
      const p = result.data;
      if (!p) {
        wx.showToast({ title: '产品不存在', icon: 'none' });
        return;
      }

      const showOpened = !!(p.openedDate || p.openedShelfLifeMonths);
      this.setData({
        'form.brand': p.brand || '',
        'form.name': p.name || '',
        'form.category': p.category || '',
        'form.specification': p.specification || '',
        'form.productionDate': p.productionDate || '',
        'form.shelfLifeMonths': p.shelfLifeMonths ? String(p.shelfLifeMonths) : '',
        'form.openedDate': p.openedDate || '',
        'form.openedShelfLifeMonths': p.openedShelfLifeMonths ? String(p.openedShelfLifeMonths) : '',
        showOpened,
      });
      this.updateExpiryPreview();
    }).catch(() => {
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  // --- 加载分类列表 ---
  loadCategories() {
    wx.cloud.callFunction({
      name: 'productOps',
      data: { action: 'categoryList' },
    }).then((res) => {
      const result = (res && res.result) || {};
      this.setData({ categories: result.data || [] });
    }).catch(() => {
      this.setData({ categories: [] });
    });
  },

  // --- 表单输入 ---
  onFormInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({ [`form.${field}`]: value });

    if (field === 'shelfLifeMonths' || field === 'openedShelfLifeMonths') {
      this.updateExpiryPreview();
    }
  },

  onDateChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
    this.updateExpiryPreview();
  },

  onCategoryTap(e) {
    this.setData({ 'form.category': e.currentTarget.dataset.name });
  },

  // --- 快速添加新分类 ---
  onAddCategory() {
    wx.showModal({
      title: '新建分类',
      editable: true,
      placeholderText: '如：眼霜',
      success: (res) => {
        if (!res.confirm || !res.content) return;
        const name = res.content.trim();
        if (!name) {
          wx.showToast({ title: '分类名称不能为空', icon: 'none' });
          return;
        }
        if (name.length > 20) {
          wx.showToast({ title: '分类名称不能超过20个字符', icon: 'none' });
          return;
        }
        wx.cloud.callFunction({
          name: 'productOps',
          data: { action: 'categoryAdd', name },
        }).then((cfRes) => {
          const result = (cfRes && cfRes.result) || {};
          if (!result.success) {
            wx.showToast({ title: result.error || '创建失败', icon: 'none' });
            return;
          }
          wx.showToast({ title: '分类已创建', icon: 'success' });
          // 刷新分类列表并自动选中新分类
          this.setData({ 'form.category': name });
          this.loadCategories();
        }).catch(() => {
          wx.showToast({ title: '创建失败', icon: 'none' });
        });
      },
    });
  },

  toggleOpened() {
    this.setData({ showOpened: !this.data.showOpened });
  },

  // --- 过期时间实时预览 ---
  updateExpiryPreview() {
    const { productionDate, shelfLifeMonths, openedDate, openedShelfLifeMonths } = this.data.form;
    if (!productionDate || !shelfLifeMonths || Number(shelfLifeMonths) <= 0) {
      this.setData({ expiryPreview: '' });
      return;
    }

    const expiryDate = calcExpirationDate({
      productionDate,
      shelfLifeMonths: Number(shelfLifeMonths),
      openedDate: openedDate || null,
      openedShelfLifeMonths: openedShelfLifeMonths ? Number(openedShelfLifeMonths) : null,
    });
    this.setData({ expiryPreview: expiryDate });
  },

  // --- 保存修改 ---
  onSaveTap() {
    const { form, productId } = this.data;

    // 前端校验（与添加产品一致）
    if (!form.name || !form.name.trim()) {
      wx.showToast({ title: '请输入产品名称', icon: 'none' });
      return;
    }
    if (!form.category) {
      wx.showToast({ title: '请选择分类', icon: 'none' });
      return;
    }
    if (!form.productionDate) {
      wx.showToast({ title: '请选择生产日期', icon: 'none' });
      return;
    }
    if (!form.shelfLifeMonths || Number(form.shelfLifeMonths) <= 0) {
      wx.showToast({ title: '保质期必须大于0', icon: 'none' });
      return;
    }

    this.setData({ saving: true });

    const payload = {
      action: 'update',
      _id: productId,
      name: form.name.trim(),
      brand: form.brand.trim(),
      category: form.category,
      specification: form.specification.trim(),
      productionDate: form.productionDate,
      shelfLifeMonths: Number(form.shelfLifeMonths),
    };

    // 附带开封信息
    if (form.openedDate) {
      payload.openedDate = form.openedDate;
      payload.openedShelfLifeMonths = (form.openedShelfLifeMonths && Number(form.openedShelfLifeMonths) > 0)
        ? Number(form.openedShelfLifeMonths)
        : 0;
    } else {
      // 清除开封信息：传 null 让 recalcOnUpdate 合并后不触发开封逻辑
      payload.openedDate = null;
      payload.openedShelfLifeMonths = null;
    }

    wx.cloud.callFunction({
      name: 'productOps',
      data: payload,
    }).then((res) => {
      const result = (res && res.result) || {};
      this.setData({ saving: false });

      if (!result.success) {
        wx.showToast({ title: result.error || '保存失败', icon: 'none' });
        return;
      }

      wx.showToast({ title: '修改成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    }).catch((err) => {
      this.setData({ saving: false });
      const errMsg = (err && err.errMsg) || '';
      if (
        errMsg.indexOf('-601034') !== -1 ||
        errMsg.indexOf('-501000') !== -1 ||
        errMsg.indexOf('没有权限') !== -1
      ) {
        wx.showModal({
          title: '云开发未配置',
          content: '请先在微信开发者工具中开通云开发，确认云函数已部署。',
          showCancel: false,
        });
      } else {
        wx.showToast({ title: err.message || errMsg || '保存失败', icon: 'none' });
      }
    });
  },
});
