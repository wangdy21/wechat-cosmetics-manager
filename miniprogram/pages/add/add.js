/**
 * 添加产品页逻辑
 * 双模式：拍照识别 / 手动录入
 * 对接 productOps 云函数保存产品
 * 分类从云数据库 categories 集合动态加载
 */
const { calcExpirationDate, formatDate } = require('../../utils/date');
const { chooseImage, uploadToCloud, generateCloudPath } = require('../../utils/imageRecognizer');

// 注意：图片识别已改用 MiMo 多模态大模型（云函数端），客户端不再需要回退解析。
// MiMo 返回结构化 JSON，字段缺失时使用以下默认值策略（见 onChooseImage）。

Page({
  data: {
    mode: 'image', // 'image' | 'manual'
    imagePath: '', // 本地临时图片路径
    recognizing: false,
    recognizeStatus: '', // '' | 'success' | 'fail'
    parsedName: '',
    recognizeError: '',
    imageFileID: '', // 云端文件ID
    defaultedFields: [], // 使用默认值填充的必填字段名称列表
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

  onLoad() {
    this.setData({ today: formatDate(new Date()) });
  },

  onShow() {
    // 每次展示重新加载分类，确保从分类管理页返回后能看到新增的分类
    this.loadCategories();
  },

  // --- 加载用户自定义分类 ---
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

  // --- 模式切换 ---
  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ mode, recognizeStatus: '', recognizeError: '', defaultedFields: [] });
  },

  switchToManual() {
    this.setData({ mode: 'manual', recognizeStatus: '', recognizeError: '', defaultedFields: [] });
  },

  // --- 选择图片并识别 ---
  async onChooseImage() {
    if (this.data.recognizing) return;

    // 1. 选择图片
    let paths;
    try {
      paths = await chooseImage(1);
    } catch (err) {
      // 用户取消，不做任何操作
      return;
    }

    const localPath = paths[0];

    // 立即显示图片预览并开始识别
    this.setData({
      imagePath: localPath,
      recognizing: true,
      recognizeStatus: '',
      recognizeError: '',
      imageFileID: '',
    });

    // 2. 上传到云存储
    const cloudPath = generateCloudPath();
    let fileID;
    try {
      fileID = await uploadToCloud(localPath, cloudPath);
    } catch (err) {
      this.setData({
        recognizing: false,
        recognizeStatus: 'fail',
        recognizeError: '图片上传失败，请检查网络后重试',
      });
      return;
    }

    // 3. 调用云函数识别（MiMo 多模态，设置 30 秒超时）
    try {
      const res = await wx.cloud.callFunction({
        name: 'productOps',
        data: { action: 'recognizeProduct', fileID },
        config: { timeout: 30000 },
      });

      const result = (res && res.result) || {};

      if (!result.success) {
        this.setData({
          recognizing: false,
          recognizeStatus: 'fail',
          recognizeError: result.error || '识别失败，请手动录入',
          imageFileID: fileID,
        });
        return;
      }

      // 识别成功：云函数已推断生产日期和保质期
      const data = result.data || {};
      const formData = {
        name: data.name || '',
        brand: data.brand || '',
        specification: data.specification || '',
      };
      const defaultedFields = [];

      // 必填字段：名称 —— 未识别到时填充默认值
      if (!formData.name) {
        formData.name = '待确认产品名称';
        defaultedFields.push('产品名称');
      }

      // 必填字段：生产日期 —— 云函数已推断（未来日期→反推，过去日期→直接使用），null 时兜底今天
      if (data.productionDate) {
        formData.productionDate = data.productionDate;
      } else {
        formData.productionDate = this.data.today;
        defaultedFields.push('生产日期');
      }

      // 必填字段：保质期（月） —— 云函数已填充默认 36 月
      if (data.shelfLifeMonths && data.shelfLifeMonths > 0) {
        formData.shelfLifeMonths = String(data.shelfLifeMonths);
      } else {
        formData.shelfLifeMonths = '36';
        defaultedFields.push('保质期');
      }

      // 包装原始日期信息（供用户核对）
      let parsedName = formData.name;
      if (data.packageDate) {
        const isExpiry = data.packageDate > this.data.today;
        parsedName = formData.name + (isExpiry ? '（有效期至 ' : '（包装日期 ') + data.packageDate + '）';
      }

      this.setData({
        recognizing: false,
        recognizeStatus: 'success',
        parsedName: parsedName,
        imageFileID: fileID,
        defaultedFields,
        'form.name': formData.name,
        'form.brand': formData.brand,
        'form.specification': formData.specification,
        'form.productionDate': formData.productionDate,
        'form.shelfLifeMonths': formData.shelfLifeMonths,
      });

      // 如果识别到了分类，自动选中
      if (data.category) {
        this.setData({ 'form.category': data.category });
      }

      // 填充了生产日期和保质期后，刷新过期时间预览
      this.updateExpiryPreview();
    } catch (err) {
      const errMsg = (err && err.errMsg) || '';
      let recognizeError;
      if (errMsg.indexOf('-601034') !== -1 || errMsg.indexOf('没有权限') !== -1) {
        recognizeError = '云开发未配置，请先开通云开发';
      } else if (errMsg.toLowerCase().indexOf('timeout') !== -1) {
        recognizeError = '识别超时，请检查网络后重试';
      } else {
        // 显示实际错误信息，便于排查
        recognizeError = errMsg || err.message || '识别服务调用失败，请手动录入';
      }
      this.setData({
        recognizing: false,
        recognizeStatus: 'fail',
        recognizeError: recognizeError,
        imageFileID: fileID,
      });
    }
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

    // 根据当前识别状态确定商品来源
    const source = this.data.recognizeStatus === 'success' ? 'image' : 'manual';

    const payload = {
      action: 'add',
      name: form.name.trim(),
      brand: form.brand.trim(),
      category: form.category,
      specification: form.specification.trim(),
      productionDate: form.productionDate,
      shelfLifeMonths: Number(form.shelfLifeMonths),
      imageUrl: this.data.imageFileID || '',
      source,
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
      imagePath: '',
      imageFileID: '',
      recognizeStatus: '',
      parsedName: '',
      recognizeError: '',
      defaultedFields: [],
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
      },
    });
  },
});
