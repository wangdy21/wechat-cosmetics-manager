/**
 * productOps 云函数入口
 * 通过 action 参数分发到各操作
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const productsCollection = db.collection('products');
const settingsCollection = db.collection('reminder_settings');
const categoriesCollection = db.collection('categories');

const {
  validateAddInput,
  validateUpdateInput,
  validateUpdateStatusInput,
  resolveStatus,
  buildProductRecord,
  recalcOnUpdate,
} = require('./logic');
const { callMiMo } = require('./mimo');
const { calcRemainingDays } = require('./date');

function getRecordOwner(record) {
  return (record && (record.ownerOpenid || record._openid)) || '';
}

async function queryProducts(where, page, pageSize) {
  // 云数据库单次 get() 最多返回 100 条，需分批拉取
  const MAX_LIMIT = 100;

  const countResult = await productsCollection.where(where).count();
  const total = countResult.total;

  // 需要获取的记录数 = 本页应有的条数（考虑实际总量）
  const skip = (page - 1) * pageSize;
  const needed = Math.min(pageSize, Math.max(0, total - skip));

  if (needed <= 0) {
    return { list: [], total, page, pageSize };
  }

  // 分批拉取，每批最多 MAX_LIMIT 条
  let list = [];
  let batchSkip = skip;
  let remaining = needed;

  while (remaining > 0) {
    const batchLimit = Math.min(remaining, MAX_LIMIT);
    const { data: batch } = await productsCollection
      .where(where)
      .orderBy('expirationDate', 'asc')
      .skip(batchSkip)
      .limit(batchLimit)
      .get();
    list = list.concat(batch);
    batchSkip += batch.length;
    remaining -= batch.length;
    // 批次返回不足预期，说明已无更多数据
    if (batch.length < batchLimit) break;
  }

  return { list, total, page, pageSize };
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action } = event;

  try {
    switch (action) {
      case 'add':
        return await handleAdd(event, OPENID);
      case 'list':
        return await handleList(event, OPENID);
      case 'get':
        return await handleGet(event, OPENID);
      case 'update':
        return await handleUpdate(event, OPENID);
      case 'updateStatus':
        return await handleUpdateStatus(event, OPENID);
      case 'delete':
        return await handleDelete(event, OPENID);
      case 'categoryList':
        return await handleCategoryList(event, OPENID);
      case 'categoryAdd':
        return await handleCategoryAdd(event, OPENID);
      case 'categoryDelete':
        return await handleCategoryDelete(event, OPENID);
      case 'recognizeProduct':
        return await handleRecognizeProduct(event, OPENID);
      case 'settingsGet':
        return await handleSettingsGet(event, OPENID);
      case 'settingsSave':
        return await handleSettingsSave(event, OPENID);
      default:
        return { success: false, error: '未知操作: ' + action };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
};

async function getAdvanceDays(openid) {
  try {
    const { data } = await settingsCollection
      .where(_.or([
        { ownerOpenid: openid },
        { _openid: openid },
      ]))
      .limit(1)
      .get();
    return data.length > 0 ? data[0].advanceDays : 30;
  } catch (e) {
    return 30;
  }
}

async function handleAdd(event, openid) {
  const error = validateAddInput(event);
  if (error) return { success: false, error };

  const advanceDays = await getAdvanceDays(openid);
  const record = {
    ...buildProductRecord(event, advanceDays, new Date()),
    ownerOpenid: openid,
  };

  const result = await productsCollection.add({ data: record });
  return {
    success: true,
    data: { _id: result._id, ...record },
  };
}

async function handleList(event, openid) {
  const { category, status, keyword, page = 1, pageSize = 20 } = event;
  const where = { ownerOpenid: openid };
  if (category) where.category = category;
  if (status) where.status = status;
  if (keyword) {
    where.name = db.RegExp({ regexp: keyword, options: 'i' });
  }

  let data = await queryProducts(where, page, pageSize);

  if (data.total === 0) {
    const legacyWhere = { ...where, _openid: openid };
    delete legacyWhere.ownerOpenid;
    data = await queryProducts(legacyWhere, page, pageSize);
  }

  return { success: true, data };
}

async function handleGet(event, openid) {
  const { _id } = event;
  if (!_id) return { success: false, error: '缺少产品ID' };

  const { data } = await productsCollection.doc(_id).get();
  if (getRecordOwner(data) !== openid) {
    return { success: false, error: '无权访问' };
  }
  return { success: true, data };
}

async function handleUpdate(event, openid) {
  const { _id, ...updates } = event;
  if (!_id) return { success: false, error: '缺少产品ID' };
  delete updates.action;
  // 保护 source 字段：商品来源在创建时确定，编辑时不可修改
  delete updates.source;

  const error = validateUpdateInput(updates);
  if (error) return { success: false, error };

  const { data: existing } = await productsCollection.doc(_id).get();
  if (getRecordOwner(existing) !== openid) {
    return { success: false, error: '无权访问' };
  }

  const advanceDays = await getAdvanceDays(openid);
  const extra = recalcOnUpdate(existing, updates, advanceDays, new Date());
  const merged = { ...updates, ...extra };

  await productsCollection.doc(_id).update({ data: merged });
  return { success: true, data: { _id, ...merged } };
}

async function handleUpdateStatus(event, openid) {
  const { _id, status } = event;
  if (!_id) return { success: false, error: '缺少产品ID' };

  const error = validateUpdateStatusInput(status);
  if (error) return { success: false, error };

  const { data: existing } = await productsCollection.doc(_id).get();
  if (getRecordOwner(existing) !== openid) {
    return { success: false, error: '无权访问' };
  }

  await productsCollection.doc(_id).update({
    data: { status, updatedAt: new Date().toISOString() },
  });
  return { success: true };
}

async function handleDelete(event, openid) {
  const { _id } = event;
  if (!_id) return { success: false, error: '缺少产品ID' };

  const { data: existing } = await productsCollection.doc(_id).get();
  if (getRecordOwner(existing) !== openid) {
    return { success: false, error: '无权访问' };
  }

  await productsCollection.doc(_id).remove();
  return { success: true };
}

// --- 分类操作 ---

async function handleCategoryList(event, openid) {
  const { data } = await categoriesCollection
    .where(_.or([
      { ownerOpenid: openid },
      { _openid: openid },
      { _openid: 'system' },
    ]))
    .orderBy('sortOrder', 'asc')
    .limit(100)
    .get();
  return { success: true, data };
}

async function handleCategoryAdd(event, openid) {
  const { name } = event;
  if (!name || !name.trim()) return { success: false, error: '分类名称不能为空' };

  const trimmedName = name.trim();
  if (trimmedName.length > 20) return { success: false, error: '分类名称不能超过 20 个字符' };

  // 检查重名（当前用户已有 + 系统预设）
  const { data: existing } = await categoriesCollection
    .where(_.or([
      { ownerOpenid: openid, name: trimmedName },
      { _openid: openid, name: trimmedName },
      { _openid: 'system', name: trimmedName },
    ]))
    .limit(1)
    .get();
  if (existing.length > 0) return { success: false, error: '分类已存在' };

  // 获取当前用户分类数量用于排序
  const countResult = await categoriesCollection
    .where(_.or([
      { ownerOpenid: openid },
      { _openid: openid },
    ]))
    .count();

  const record = {
    name: trimmedName,
    icon: 'custom',
    sortOrder: countResult.total + 1,
    ownerOpenid: openid,
    createdAt: new Date(),
  };

  const result = await categoriesCollection.add({ data: record });
  return { success: true, data: { _id: result._id, ...record } };
}

async function handleCategoryDelete(event, openid) {
  const { _id } = event;
  if (!_id) return { success: false, error: '缺少分类ID' };

  try {
    const { data: existing } = await categoriesCollection.doc(_id).get();
    const owner = existing.ownerOpenid || existing._openid;
    // 允许用户删除自己的分类或系统预设分类
    if (owner && owner !== openid && owner !== 'system') {
      return { success: false, error: '无权删除此分类' };
    }
  } catch (e) {
    return { success: false, error: '分类不存在' };
  }

  await categoriesCollection.doc(_id).remove();
  return { success: true };
}

// --- 图片识别操作 ---

/**
 * 将 MiMo 内部错误消息映射为合约定义的面向用户错误
 */
function mapMiMoError(errMsg) {
  if (errMsg === 'MiMo 返回内容为空') return '未能识别，请手动录入';
  if (errMsg.indexOf('MiMo 响应解析失败') === 0) return '识别结果异常，请手动录入';
  if (errMsg.indexOf('MiMo 请求失败') === 0) return '识别服务暂时不可用';
  if (errMsg.indexOf('MiMo HTTP') === 0) return '识别服务暂时不可用';
  return errMsg;
}

/**
 * 校验 MiMo 返回的商品信息字段类型
 */
function normalizeMiMoInfo(info) {
  if (info.shelfLifeMonths !== null && info.shelfLifeMonths !== undefined) {
    info.shelfLifeMonths = Number(info.shelfLifeMonths);
    if (isNaN(info.shelfLifeMonths)) info.shelfLifeMonths = null;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (info.expiryDate && !dateRegex.test(info.expiryDate)) info.expiryDate = null;
  if (info.productionDate && !dateRegex.test(info.productionDate)) info.productionDate = null;

  // 空字符串 → null
  ['brand', 'name', 'specification', 'category'].forEach(function (field) {
    if (typeof info[field] === 'string' && info[field].trim() === '') {
      info[field] = null;
    }
  });

  return info;
}

async function handleRecognizeProduct(event, openid) {
  const { fileID } = event;
  if (!fileID) return { success: false, error: '缺少图片文件' };

  // 从云存储下载图片
  let imageBuffer;
  try {
    const res = await cloud.downloadFile({ fileID });
    imageBuffer = res.fileContent;
  } catch (e) {
    return { success: false, error: '图片下载失败' };
  }

  // 调用 MiMo 多模态识别
  let miMoResult;
  try {
    miMoResult = await callMiMo(imageBuffer);
  } catch (e) {
    return { success: false, error: mapMiMoError(e.message) };
  }

  // 校验并标准化字段类型
  const info = normalizeMiMoInfo(miMoResult.info);

  // 计算剩余保质期天数
  let remainingDays = null;
  if (info.expiryDate) {
    remainingDays = calcRemainingDays(info.expiryDate, new Date());
  }

  return {
    success: true,
    data: {
      brand: info.brand,
      name: info.name,
      specification: info.specification,
      category: info.category,
      shelfLifeMonths: info.shelfLifeMonths,
      productionDate: info.productionDate,
      expiryDate: info.expiryDate,
      remainingDays: remainingDays,
      rawResponse: miMoResult.rawContent,
    },
  };
}

// --- 设置操作 ---

async function handleSettingsGet(event, openid) {
  const { data } = await settingsCollection
    .where(_.or([
      { ownerOpenid: openid },
      { _openid: openid },
    ]))
    .limit(1)
    .get();
  if (data.length > 0) {
    return { success: true, data: data[0] };
  }
  return { success: true, data: null };
}

async function handleSettingsSave(event, openid) {
  const { advanceDays, enablePush, pushFrequency } = event;

  const { data: existing } = await settingsCollection
    .where(_.or([
      { ownerOpenid: openid },
      { _openid: openid },
    ]))
    .limit(1)
    .get();

  const updates = {};
  if (advanceDays !== undefined) updates.advanceDays = advanceDays;
  if (enablePush !== undefined) updates.enablePush = enablePush;
  if (pushFrequency !== undefined) updates.pushFrequency = pushFrequency;

  if (existing.length > 0) {
    await settingsCollection.doc(existing[0]._id).update({ data: updates });
    return { success: true };
  }

  const record = {
    ownerOpenid: openid,
    advanceDays: advanceDays || 30,
    enablePush: enablePush || false,
    pushFrequency: pushFrequency || 'daily',
  };
  await settingsCollection.add({ data: record });
  return { success: true };
}
