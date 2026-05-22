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
  validateUpdateStatusInput,
  resolveStatus,
  buildProductRecord,
  recalcOnUpdate,
} = require('./logic');

function getRecordOwner(record) {
  return (record && (record.ownerOpenid || record._openid)) || '';
}

async function queryProducts(where, page, pageSize) {
  const skip = (page - 1) * pageSize;
  const countResult = await productsCollection.where(where).count();
  const total = countResult.total;

  const { data: list } = await productsCollection
    .where(where)
    .orderBy('expirationDate', 'asc')
    .skip(skip)
    .limit(pageSize)
    .get();

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
      default:
        return { success: false, error: '未知操作: ' + action };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
};

async function getAdvanceDays(openid) {
  try {
    const { data } = await settingsCollection.where({ _openid: openid }).limit(1).get();
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
