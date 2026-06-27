/**
 * 图像识别工具
 * 职责：图片选择、上传到云存储、调用云函数识别商品信息
 * 注：识别由 MiMo 多模态大模型（productOps 云函数）完成
 */

/**
 * 选择图片（拍照或相册）
 * @param {number} count 最多选择数量，默认1
 * @returns {Promise<string[]>} 本地临时文件路径数组
 */
function chooseImage(count) {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: count || 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const paths = res.tempFiles.map((f) => f.tempFilePath);
        resolve(paths);
      },
      fail: (err) => {
        // 用户取消不视为错误
        if (err.errMsg && err.errMsg.indexOf('cancel') !== -1) {
          reject(new Error('cancel'));
        } else {
          reject(err);
        }
      },
    });
  });
}

/**
 * 上传图片到云存储
 * @param {string} filePath 本地临时文件路径
 * @param {string} cloudPath 云端文件名
 * @returns {Promise<string>} fileID
 */
function uploadToCloud(filePath, cloudPath) {
  return wx.cloud.uploadFile({
    cloudPath,
    filePath,
  }).then((res) => res.fileID);
}

/**
 * 生成云端文件路径
 * @returns {string} 格式：recognize/<timestamp>_<random>.jpg
 */
function generateCloudPath() {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return 'recognize/' + ts + '_' + rand + '.jpg';
}

/**
 * 完整的图片识别流程：选图 → 上传 → 调用云函数识别
 * @returns {Promise<{
 *   success: boolean,
 *   brand: string,
 *   name: string,
 *   specification: string,
 *   category: string,
 *   rawResponse: string,
 *   imageFileID: string,
 *   error: string
 * }>}
 */
async function recognizeFromImage() {
  // 1. 选择图片
  let paths;
  try {
    paths = await chooseImage(1);
  } catch (err) {
    if (err.message === 'cancel') {
      return { success: false, error: 'cancel' };
    }
    return { success: false, error: '选择图片失败' };
  }

  const filePath = paths[0];
  const cloudPath = generateCloudPath();

  // 2. 上传到云存储
  let fileID;
  try {
    fileID = await uploadToCloud(filePath, cloudPath);
  } catch (err) {
    return { success: false, error: '图片上传失败', localPath: filePath };
  }

  // 3. 调用云函数识别
  try {
    const res = await wx.cloud.callFunction({
      name: 'productOps',
      data: { action: 'recognizeProduct', fileID },
    });

    const result = (res && res.result) || {};
    if (!result.success) {
      return { success: false, error: result.error || '识别失败', imageFileID: fileID, localPath: filePath };
    }

    return {
      success: true,
      brand: result.data.brand || '',
      name: result.data.name || '',
      specification: result.data.specification || '',
      category: result.data.category || '',
      shelfLifeMonths: result.data.shelfLifeMonths || null,
      productionDate: result.data.productionDate || null,
      expiryDate: result.data.expiryDate || null,
      remainingDays: result.data.remainingDays !== undefined ? result.data.remainingDays : null,
      rawResponse: result.data.rawResponse || '',
      imageFileID: fileID,
      localPath: filePath,
    };
  } catch (err) {
    const errMsg = (err && err.errMsg) || '';
    if (errMsg.indexOf('-601034') !== -1 || errMsg.indexOf('没有权限') !== -1) {
      return { success: false, error: '云开发未配置，请先开通云开发', imageFileID: fileID, localPath: filePath };
    }
    return { success: false, error: '识别服务调用失败', imageFileID: fileID, localPath: filePath };
  }
}

module.exports = {
  chooseImage,
  uploadToCloud,
  generateCloudPath,
  recognizeFromImage,
};
