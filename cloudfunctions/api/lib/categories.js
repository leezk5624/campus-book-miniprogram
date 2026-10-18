'use strict';

const { assert } = require('./errors');
const { cleanText, toInteger } = require('./validate');

function createCategoryService(options) {
  const db = options.db;
  const _ = options._;
  const store = options.store;
  const collections = options.collections;
  const requireAdmin = options.requireAdmin;
  const invalidateCategoryCounts = options.invalidateCategoryCounts;

  async function getCategories(openid, event) {
    const includeDisabled = !!(event && event.includeDisabled);
    if (includeDisabled) await requireAdmin(openid);
    const where = includeDisabled
      ? { deleted: _.neq(true) }
      : _.and([{ deleted: _.neq(true) }, { enabled: _.neq(false) }]);
    const categories = await store.getAll(collections.categories, where, 'sort', 'asc', 200);
    return { categories };
  }

  async function saveCategory(openid, event) {
    await requireAdmin(openid);
    const input = (event && event.category) || {};
    const name = cleanText(input.name, 12);
    assert(name, '请填写分类名称');
    const id = cleanText(input._id, 64);
    const data = {
      name,
      sort: toInteger(input.sort, 0, -9999, 9999),
      enabled: input.enabled !== false,
      deleted: false,
      updateTime: db.serverDate()
    };
    if (id) {
      const existing = await store.getById(collections.categories, id);
      assert(existing && !existing.deleted, '分类不存在', 'NOT_FOUND');
      await store.writeCollection(collections.categories, (col) => col.doc(id).update({ data }));
      invalidateCategoryCounts();
      return Object.assign({ _id: id }, existing, data);
    }
    data.createTime = db.serverDate();
    const result = await store.writeCollection(collections.categories, (col) => col.add({ data }));
    invalidateCategoryCounts();
    return Object.assign({ _id: result._id }, data);
  }

  async function deleteCategory(openid, event) {
    await requireAdmin(openid);
    const id = cleanText(event.categoryId, 64);
    assert(id, '缺少分类标识');
    const category = await store.getById(collections.categories, id);
    assert(category && !category.deleted, '分类不存在', 'NOT_FOUND');
    // 事务里无法自动重试，先确保集合存在。
    await store.ensureCollection(collections.books);
    // 事务保证检查与删除在同一快照，避免期间有新书写入。
    await db.runTransaction(async (transaction) => {
      const result = await transaction.collection(collections.books)
        .where({ categoryId: id, deleted: _.neq(true) })
        .limit(1)
        .get();
      assert(!((result && result.data) || []).length, '该分类下还有图书，不能删除');
      await transaction.collection(collections.categories).doc(id).update({
        data: { deleted: true, enabled: false, updateTime: db.serverDate() }
      });
    });
    invalidateCategoryCounts();
    return { success: true };
  }

  return { getCategories, saveCategory, deleteCategory };
}

module.exports = { createCategoryService };
