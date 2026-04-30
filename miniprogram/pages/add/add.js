/**
 * 添加产品页逻辑
 * 双模式：链接导入 / 手动录入
 * 对接 productOps 云函数保存产品
 * 分类从云数据库 categories 集合动态加载
 */
const { calcExpirationDate, formatDate } = require('../../utils/date');
const { parseInput } = require('../../utils/parser');

Page({
  data: {
    mode: 'link', // 'link' | 'manual'
    linkText: '',
    parsing: false,
    parseStatus: '', // '' | 'success' | 'fail'
    parsedName: '',
    parseError: '',
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
      sourceLink: '',
    },
  },

  onLoad() {
    this.setData({ today: formatDate(new Date()) });
  },

  onShow() {
    // 每次展示重新加载分类，确保从分类管理页返回后能看到新增的分类
    this.loadCategories();
  },

  // --- 加载用户自定义分类 ---
  loadCategories() {
    const db = wx.cloud.database();
    db.collection('categories')
      .orderBy('sortOrder', 'asc')
      .get()
      .then((res) => {
        this.setData({ categories: res.data || [] });
      })
      .catch(() => {
        this.setData({ categories: [] });
      });
  },

  // --- 跳转分类管理页 ---
  goCategoryManage() {
    wx.navigateTo({ url: '/pages/category/category' });
  },

  // --- 模式切换 ---
  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ mode });
  },

  switchToManual() {
    this.setData({ mode: 'manual' });
  },

  // --- 链接输入 ---
  onLinkInput(e) {
    this.setData({ linkText: e.detail.value, parseStatus: '' });
  },

  // --- 解析链接 ---
  onParseTap() {
    const { linkText } = this.data;
    const result = parseInput(linkText);

    if (result.type === 'unknown') {
      this.setData({
        parseStatus: 'fail',
        parseError: '无法识别链接格式，请检查后重试',
      });
      return;
    }

    this.setData({ parsing: true, parseStatus: '' });

    wx.cloud.callFunction({
      name: 'parseLink',
      data: {
        type: result.type,
        value: result.value,
      },
    }).then((res) => {
      const parsed = res.result;
      if (parsed && parsed.name) {
        this.setData({
          parsing: false,
          parseStatus: 'success',
          parsedName: parsed.name,
          'form.name': parsed.name || '',
          'form.brand': parsed.brand || '',
          'form.specification': parsed.specification || '',
          'form.sourceLink': linkText,
        });
        // 如果解析到了分类，自动选中
        if (parsed.category) {
          this.setData({ 'form.category': parsed.category });
        }
      } else {
        this.setData({
          parsing: false,
          parseStatus: 'fail',
          parseError: '解析未能获取产品信息，请手动录入',
        });
      }
    }).catch((err) => {
      const errMsg = (err && err.errMsg) || '';
      const isCloudError = errMsg.indexOf('-601034') !== -1 || errMsg.indexOf('没有权限') !== -1;
      this.setData({
        parsing: false,
        parseStatus: 'fail',
        parseError: isCloudError ? '云开发未配置，请先开通云开发' : '链接解析失败，请手动录入',
      });
    });
  },

  // --- 表单输入 ---
  onFormInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({ [`form.${field}`]: value });

    // 数字字段变更时重算过期预览
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

  // --- 保存产品 ---
  onSaveTap() {
    const { form } = this.data;

    // 前端基础校验
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
      action: 'add',
      name: form.name.trim(),
      brand: form.brand.trim(),
      category: form.category,
      specification: form.specification.trim(),
      productionDate: form.productionDate,
      shelfLifeMonths: Number(form.shelfLifeMonths),
      sourceLink: form.sourceLink || '',
    };

    // 附带开封信息
    if (form.openedDate) {
      payload.openedDate = form.openedDate;
    }
    if (form.openedShelfLifeMonths && Number(form.openedShelfLifeMonths) > 0) {
      payload.openedShelfLifeMonths = Number(form.openedShelfLifeMonths);
    }

    wx.cloud.callFunction({
      name: 'productOps',
      data: payload,
    }).then((res) => {
      const result = (res && res.result) || {};

      this.setData({ saving: false });

      if (!result.success) {
        const message = result.error || '保存失败';
        wx.showToast({ title: message, icon: 'none' });
        return;
      }

      wx.showToast({ title: '保存成功', icon: 'success' });
      this.resetForm();
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
          content: '请先在微信开发者工具中开通云开发，确认云函数已部署，并在 app.js 中填入正确的云环境 ID。',
          showCancel: false,
        });
      } else if (errMsg.toLowerCase().indexOf('timeout') !== -1) {
        wx.showModal({
          title: '保存超时',
          content: '云函数执行超时，请检查云函数部署、网络连接和数据库权限后重试。',
          showCancel: false,
        });
      } else {
        wx.showToast({ title: err.message || errMsg || '保存失败', icon: 'none' });
      }
    });
  },

  // --- 重置表单 ---
  resetForm() {
    this.setData({
      linkText: '',
      parseStatus: '',
      parsedName: '',
      parseError: '',
      expiryPreview: '',
      showOpened: false,
      form: {
        brand: '',
        name: '',
        category: '',
        specification: '',
        productionDate: '',
        shelfLifeMonths: '',
        openedDate: '',
        openedShelfLifeMonths: '',
        sourceLink: '',
      },
    });
  },
});
