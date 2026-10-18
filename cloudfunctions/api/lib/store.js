'use strict';

// 数据库读写封装：统一处理「集合不存在」，并缓存分类计数。

const { isMissingCollection, isMissingDocument, AppError } = require('./errors');
const { cleanText } = require('./validate');
const { CATEGORY_COUNTS_TTL } = require('./constants');

function createStore(options) {
  const db = options.db;
  const _ = options._;
  const $ = options.$;
  const collections = options.collections;

  // 分类计数 30s 缓存，避免每次翻页都跑一次聚合。
  let categoryCountsCache = { includeDisabled: null, at: 0, value: null };
  let collectionsEnsured = false;
  let legacyMigrated = false;

  async function getAll(collectionName, where, orderField, direction, maxItems, fields) {
    const max = Math.max(1, Math.min(Number(maxItems) || 1000, 5000));
    const pageSize = 100;
    const list = [];
    let skip = 0;
    while (list.length < max) {
      let query = db.collection(collectionName).where(where || {});
      if (fields) query = query.field(fields);
      if (orderField) query = query.orderBy(orderField, direction || 'asc');
      let result;
      try {
        result = await query.skip(skip).limit(Math.min(pageSize, max - list.length)).get();
      } catch (error) {
        if (isMissingCollection(error)) return list;
        throw error;
      }
      const rows = result.data || [];
      list.push.apply(list, rows);
      if (rows.length < pageSize) break;
      skip += rows.length;
    }
    return list;
  }

  async function getById(collectionName, id) {
    if (!id) return null;
    try {
      const result = await db.collection(collectionName).doc(id).get();
      return result.data || null;
    } catch (error) {
      if (isMissingCollection(error) || isMissingDocument(error)) return null;
      throw error;
    }
  }

  async function countWhere(collectionName, where) {
    try {
      const result = await db.collection(collectionName).where(where || {}).count();
      return result.total || 0;
    } catch (error) {
      if (isMissingCollection(error)) return 0;
      throw error;
    }
  }

  // 一次聚合代替逐分类 count。
  async function countBooksByCategory(match) {
    try {
      const result = await db.collection(collections.books)
        .aggregate()
        .match(match)
        .group({ _id: '$categoryId', count: $.sum(1) })
        .end();
      const map = {};
      (result.list || []).forEach((item) => {
        if (item._id) map[item._id] = item.count;
      });
      return map;
    } catch (error) {
      // 聚合失败时退化为空计数，不阻断列表。
      console.warn('[api] 分类统计失败', error && (error.errMsg || error.message));
      return {};
    }
  }

  async function getCategoryCounts(includeDisabled) {
    const now = Date.now();
    if (categoryCountsCache.includeDisabled === includeDisabled
      && categoryCountsCache.value
      && now - categoryCountsCache.at < CATEGORY_COUNTS_TTL) {
      return categoryCountsCache.value;
    }
    const match = includeDisabled
      ? { deleted: _.neq(true) }
      : _.and([{ deleted: _.neq(true) }, { enabled: _.neq(false) }]);
    const value = await countBooksByCategory(match);
    categoryCountsCache = { includeDisabled, at: now, value };
    return value;
  }

  // 图书增删后让缓存立即失效，保证管理员侧计数即时准确；前台访问会重新计算一次。
  function invalidateCategoryCounts() {
    categoryCountsCache = { includeDisabled: null, at: 0, value: null };
  }

  // 云开发不会自动建集合，写入前先确认存在。
  async function ensureCollection(collectionName) {
    try {
      await db.collection(collectionName).limit(1).get();
      return true;
    } catch (error) {
      if (!isMissingCollection(error)) throw error;
    }
    if (typeof db.createCollection !== 'function') return false;
    try {
      await db.createCollection(collectionName);
      return true;
    } catch (error) {
      console.warn('[api] 自动创建集合失败', collectionName, error && (error.errMsg || error.message));
      return false;
    }
  }

  // 遇到「集合不存在」时先建表再重试一次；仍失败就给出可操作的提示。
  async function writeCollection(collectionName, operation) {
    try {
      return await operation(db.collection(collectionName));
    } catch (error) {
      if (!isMissingCollection(error)) throw error;
      if (!(await ensureCollection(collectionName))) {
        throw new AppError('COLLECTION_MISSING', '集合 ' + collectionName + ' 不存在且自动创建失败，请在云开发控制台的数据库页面手动创建后重试');
      }
      return operation(db.collection(collectionName));
    }
  }

  // 清空集合优先走条件批量删除：逐条 remove 在上千条时会把云函数拖到超时。
  async function clearCollection(collectionName) {
    for (let round = 0; round < 50; round += 1) {
      let result = null;
      try {
        result = await db.collection(collectionName).field({ _id: true }).limit(100).get();
      } catch (error) {
        if (isMissingCollection(error)) return;
        throw error;
      }
      const rows = (result && result.data) || [];
      if (!rows.length) return;
      const ids = rows.map((item) => item._id);
      try {
        await db.collection(collectionName).where({ _id: _.in(ids) }).remove();
      } catch (error) {
        // 部分环境不支持条件删除，退回逐条删除。
        await Promise.all(ids.map((id) => db.collection(collectionName).doc(id).remove()));
      }
    }
  }

  // 集合改名后，旧环境里的书目会留在原集合里。把旧集合名配到云函数的环境变量
  // LEGACY_BOOK_COLLECTION，冷启动时会自动把它的数据补进新集合一次（只在新集合为空时执行）。
  async function migrateLegacyBooks() {
    const legacy = cleanText(process.env.LEGACY_BOOK_COLLECTION, 64);
    if (!legacy || legacy === collections.books) return;
    if (await countWhere(collections.books, {})) return;

    const rows = await getAll(legacy, { deleted: _.neq(true) }, '', '', 500);
    if (!rows.length) return;
    for (const row of rows) {
      const data = Object.assign({}, row);
      delete data._id;
      // 补齐查询依赖的字段，避免迁过来的数据因为缺字段再次被过滤掉。
      data.deleted = false;
      if (data.enabled === undefined || data.enabled === null) data.enabled = true;
      if (data.sort === undefined || data.sort === null) data.sort = 0;
      if (!data.updateTime) data.updateTime = db.serverDate();
      if (!data.createTime) data.createTime = db.serverDate();
      await writeCollection(collections.books, (col) => col.add({ data }));
    }
    console.info('[api] 已从 LEGACY_BOOK_COLLECTION 迁移图书', rows.length);
    invalidateCategoryCounts();
  }

  // 历史文档可能缺 deleted / enabled / sort，补齐后排序和索引才生效。
  // 每次最多补 100 条，避免大表拖慢冷启动。
  async function backfillBookFields() {
    const rows = await getAll(
      collections.books,
      _.or([{ sort: _.exists(false) }, { deleted: _.exists(false) }, { enabled: _.exists(false) }]),
      '',
      '',
      100
    );
    if (!rows.length) return 0;
    await Promise.all(rows.map((row) => {
      const patch = {};
      if (row.deleted === undefined || row.deleted === null) patch.deleted = false;
      if (row.enabled === undefined || row.enabled === null) patch.enabled = true;
      if (row.sort === undefined || row.sort === null) patch.sort = 0;
      if (!Object.keys(patch).length) return Promise.resolve(null);
      return writeCollection(collections.books, (col) => col.doc(row._id).update({ data: patch }));
    }));
    console.info('[api] 已补全历史图书字段', rows.length);
    return rows.length;
  }

  // 冷启动时把集合补齐，避免每次写操作都先撞一次「集合不存在」。
  async function ensureCollections() {
    if (collectionsEnsured) return;
    collectionsEnsured = true;
    const names = [
      collections.users,
      collections.categories,
      collections.books,
      collections.settings,
      collections.auditLogs
    ];
    // 并发探测，串行会叠加冷启动耗时。
    await Promise.all(names.map(async (name) => {
      try {
        await ensureCollection(name);
      } catch (error) {
        // 建表失败不阻断请求，写操作会再兜一次。
        console.warn('[api] 检查集合失败', name, error && (error.errMsg || error.message));
      }
    }));

    if (!legacyMigrated) {
      legacyMigrated = true;
      try {
        await migrateLegacyBooks();
        await backfillBookFields();
      } catch (error) {
        console.warn('[api] 旧数据整理失败', error && (error.errMsg || error.message));
      }
    }
  }

  return {
    getAll,
    getById,
    countWhere,
    countBooksByCategory,
    getCategoryCounts,
    invalidateCategoryCounts,
    ensureCollection,
    writeCollection,
    clearCollection,
    ensureCollections
  };
}

module.exports = { createStore };
