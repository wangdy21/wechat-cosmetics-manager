/**
 * 添加产品页逻辑
 * 双模式：拍照识别 / 手动录入
 * 对接 productOps 云函数保存产品
 * 分类从云数据库 categories 集合动态加载
 */
const { calcExpirationDate, formatDate } = require('../../utils/date');
const { chooseImage, uploadToCloud, generateCloudPath } = require('../../utils/imageRecognizer');

/**
 * 客户端回退解析：从 rawText 中提取商品信息
 * 当云函数返回的字段为空时，尝试从原始 OCR 文本中再次提取
 */

// 产品名称指示词（用于无 key 前缀的回退识别）
const PRODUCT_NAME_INDICATORS = [
  '精华液', '精华', '面霜', '乳液', '口红', '唇膏', '唇釉', '唇彩',
  '粉底', '气垫', '眼影', '眼线', '睫毛膏', '眉笔',
  '防晒', '隔离', '化妆水', '爽肤水', '面膜', '洁面',
  '卸妆', '香水', '散粉', '蜜粉', '修容', '高光',
  '腮红', '遮瑕', '身体乳', '护手霜', '洗发水', '护发素',
];

/**
 * 判断文本是否看起来像化妆品产品名称
 */
function looksLikeProductName(text) {
  if (!text || text.length < 3) return false;
  for (const indicator of PRODUCT_NAME_INDICATORS) {
    if (text.indexOf(indicator) !== -1) return true;
  }
  return false;
}

/**
 * 客户端品牌词库（子集，用于回退提取产品名称）
 */
const CLIENT_BRAND_LIST = [
  'YSL', '兰蔻', '雅诗兰黛', '迪奥', '香奈儿', '海蓝之谜', '赫莲娜',
  'CPB', '资生堂', 'MAC', 'NARS', 'TOM FORD', 'Armani',
  '科颜氏', '倩碧', '欧舒丹', '娇韵诗', '娇兰',
  '后', '雪花秀', '悦诗风吟', '兰芝', '珂润', '芙丽芳丝',
  '欧莱雅', '美宝莲', '花西子', '完美日记', '珀莱雅', '薇诺娜',
  '百雀羚', '自然堂', '修丽可', '理肤泉', '薇姿', '雅漾',
];

function parseFromRawText(rawText) {
  const result = { name: '', brand: '', specification: '', category: '', shelfLifeMonths: null, expiryDate: null, productionDate: null };
  if (!rawText) return result;

  const lines = rawText.split('\n');
  // 保存非 key-value 行，用于回退提取
  const unmatchedLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // 匹配 "key：value" 或 "key: value" 或 "key value"
    const kv = trimmed.match(/^(.+?)[：:\s]\s*(.+)$/);
    if (!kv) {
      // 非 key-value 行，保存用于回退
      if (trimmed.length > 0) unmatchedLines.push(trimmed);
      continue;
    }

    const key = kv[1].trim();
    const value = kv[2].trim();

    if (!result.name && (key.indexOf('产品名称') !== -1 || key.indexOf('品名') !== -1)) {
      result.name = value;
    } else if (!result.brand && key.indexOf('品牌') !== -1) {
      result.brand = value.replace(/[/／].+/, '').trim() || value;
    } else if (!result.specification && (key.indexOf('净含量') !== -1 || key.indexOf('规格') !== -1)) {
      result.specification = value;
    } else if (result.shelfLifeMonths === null && key.indexOf('保质期') !== -1) {
      // 提取保质期（支持"3年"、"36个月"）
      const shelfMatch = value.match(/(\d+)\s*(年|个月|月)/);
      if (shelfMatch) {
        const num = parseInt(shelfMatch[1], 10);
        const unit = shelfMatch[2];
        result.shelfLifeMonths = unit === '年' ? num * 12 : num;
      }
    } else if (!result.expiryDate && (key.indexOf('限期使用日期') !== -1 || key.indexOf('有效期至') !== -1)) {
      // 提取到期日期
      const dateMatch = value.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        result.expiryDate = dateMatch[1];
      }
    } else if (!result.name && looksLikeProductName(value)) {
      // key 不是标准字段名，但 value 看起来像产品名称（如 key 为品牌名）
      const keyIsBrand = CLIENT_BRAND_LIST.some((b) => key.toLowerCase().indexOf(b.toLowerCase()) !== -1);
      if (keyIsBrand) {
        let name = value;
        // 去除品牌前缀
        if (result.brand) {
          const brandLower = result.brand.toLowerCase();
          if (name.toLowerCase().startsWith(brandLower)) {
            name = name.substring(result.brand.length).trim();
          }
        }
        if (name) result.name = name;
      }
    }
  }

  // 回退：从未匹配的独立行中查找产品名称
  if (!result.name) {
    for (const text of unmatchedLines) {
      if (looksLikeProductName(text)) {
        let name = text;
        if (result.brand) {
          const brandLower = result.brand.toLowerCase();
          if (name.toLowerCase().startsWith(brandLower)) {
            name = name.substring(result.brand.length).trim();
          }
        }
        if (name) result.name = name;
        break;
      }
    }
  }

  // 根据到期日期和保质期反推生产日期
  if (result.expiryDate && result.shelfLifeMonths) {
    try {
      const expiryDateObj = new Date(result.expiryDate);
      if (!isNaN(expiryDateObj.getTime())) {
        const productionDateObj = new Date(expiryDateObj);
        productionDateObj.setMonth(productionDateObj.getMonth() - result.shelfLifeMonths);
        const year = productionDateObj.getFullYear();
        const month = String(productionDateObj.getMonth() + 1).padStart(2, '0');
        const day = String(productionDateObj.getDate()).padStart(2, '0');
        result.productionDate = `${year}-${month}-${day}`;
      }
    } catch (e) {
      // 忽略日期计算错误
    }
  }

  return result;
}

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

    // 3. 调用云函数识别（OCR 耗时较长，设置 30 秒超时）
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

      // 识别成功：填充表单
      const data = result.data || {};

      // 如果云函数某些字段为空，尝试从 rawText 回退解析
      const fallback = parseFromRawText(data.rawText);
      const formData = {
        name: data.name || fallback.name || '',
        brand: data.brand || fallback.brand || '',
        specification: data.specification || fallback.specification || '',
      };
      const defaultedFields = [];

      // 必填字段：名称 —— OCR 未识别到时填充默认值
      if (!formData.name) {
        formData.name = '待确认产品名称';
        defaultedFields.push('产品名称');
      }

      // 必填字段：生产日期 —— 优先使用 OCR 识别的生产日期，否则默认今天
      if (data.productionDate) {
        formData.productionDate = data.productionDate;
      } else if (fallback.productionDate) {
        formData.productionDate = fallback.productionDate;
      } else {
        formData.productionDate = this.data.today;
        defaultedFields.push('生产日期');
      }

      // 必填字段：保质期（月） —— 优先使用 OCR 识别的保质期，否则默认 36 个月
      if (data.shelfLifeMonths && data.shelfLifeMonths > 0) {
        formData.shelfLifeMonths = String(data.shelfLifeMonths);
      } else if (fallback.shelfLifeMonths && fallback.shelfLifeMonths > 0) {
        formData.shelfLifeMonths = String(fallback.shelfLifeMonths);
      } else {
        formData.shelfLifeMonths = '36';
        defaultedFields.push('保质期');
      }

      // 如果有到期日期，显示剩余天数提示
      if (data.remainingDays !== null && data.remainingDays !== undefined) {
        if (data.remainingDays <= 0) {
          wx.showToast({ title: '产品已过期', icon: 'none', duration: 2000 });
        } else if (data.remainingDays <= 30) {
          wx.showToast({ title: `剩余${data.remainingDays}天`, icon: 'none', duration: 2000 });
        }
      }

      this.setData({
        recognizing: false,
        recognizeStatus: 'success',
        parsedName: formData.name,
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
