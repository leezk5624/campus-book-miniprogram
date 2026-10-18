'use strict';

// 图书的查询、分页、写操作与封面文件回收。

const { assert, AppError, isMissingCollection } = require('./errors');
const { cleanText, toMoney, toInteger, escapeRegExp, normalizeTags, isSafeCover } = require('./validate');
const { parsePaging } = require('./paging');
const { LIST_FIELDS } = require('./constants');

function createBookService(options) {
  const db = options.db;
  const _ = options._;
  const cloud = options.cloud;
  const store = options.store;
  const collections = options.collections;
  const requireAdmin = options.requireAdmin;
  const isAdmin = options.isAdmin;
  const ensureSettings = options.ensureSettings;
  const invalidateCategoryCounts = options.invalidateCategoryCounts;

  // 用 neq 而不是等值匹配：手工录入或旧版本写入的文档没有 deleted / enabled 字段，
  // 等值条件会把它们整条过滤掉（曾经的表现：数据写进去了，前台一条都查不到）。
  // 代价是不等值查询命中不了索引，靠 backfillBookFields 补字段缓解。
  function buildBookWhere(options_) {
    const conditions = [{ deleted: _.neq(true) }];
    if (!options_.includeDisabled) conditions.push({ enabled: _.neq(false) });
    if (options_.categoryId) conditions.push({ categoryId: options_.categoryId });
    if (options_.keyword) {
      const regexp = db.RegExp({ regexp: escapeRegExp(options_.keyword), options: 'i' });
      conditions.push(_.or([
        { name: regexp },
        { author: regexp },
        { isbn: regexp },
        { description: regexp }
      ]));
    }
    return conditions.length === 1 ? conditions[0] : _.and(conditions);
  }

  // sort + updateTime 缺复合索引时云数据会报错，退化成不带排序。
  async function queryBooks(where, skip, limit) {
    const ordered = () => db.collection(collections.books)
      .where(where)
      .field(LIST_FIELDS)
      .orderBy('sort', 'asc')
      .orderBy('updateTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get()
      .then((result) => result.data || []);

    try {
      return await ordered();
    } catch (error) {
      if (isMissingCollection(error)) return [];
      console.warn('[api] 排序查询失败，退化为无序查询：', (error && (error.errMsg || error.message)) || error);
      return db.collection(collections.books)
        .where(where)
        .field(LIST_FIELDS)
        .skip(skip)
        .limit(limit)
        .get()
        .then((result) => result.data || []);
    }
  }

  function bookData(input, includeCreateTime) {
    assert(input && typeof input === 'object', '图书参数错误');
    const name = cleanText(input.name, 60);
    const categoryId = cleanText(input.categoryId, 64);
    assert(name, '请填写图书名称');
    assert(categoryId, '请选择图书分类');

    const priceRaw = Number(input.price);
    assert(Number.isFinite(priceRaw) && priceRaw >= 0, '定价格式不正确');
    assert(priceRaw <= 100000000, '定价超出允许范围');
    const originalPriceRaw = Number(input.originalPrice);
    assert(!input.originalPrice || (Number.isFinite(originalPriceRaw) && originalPriceRaw >= 0), '划线价格式不正确');
    assert(!input.originalPrice || originalPriceRaw <= 100000000, '划线价超出允许范围');

    const isbn = cleanText(input.isbn, 20).replace(/\s/g, '');
    if (isbn) assert(/^[0-9Xx-]{10,17}$/.test(isbn), 'ISBN 格式不正确');

    // 封面 fileID 由客户端回传，服务端复核目录。
    assert(isSafeCover(input.image), '封面地址不合法', 'INVALID_PARAM');

    // 库存：空值或负数（含 -1）表示不限库存，避免被 toInteger 下界钳制成 0。
    const stockRaw = input.stock;
    const stock = stockRaw === '' || stockRaw === null || stockRaw === undefined || Number(stockRaw) < 0
      ? -1
      : toInteger(stockRaw, 0, 0, 100000);

    const data = {
      categoryId,
      name,
      author: cleanText(input.author, 40),
      publisher: cleanText(input.publisher, 60),
      isbn,
      publishYear: toInteger(input.publishYear, 0, 0, new Date().getFullYear() + 1),
      pages: toInteger(input.pages, 0, 0, 100000),
      description: cleanText(input.description, 200),
      intro: cleanText(input.intro, 2000),
      price: Math.round(priceRaw),
      originalPrice: toMoney(input.originalPrice),
      stock,
      location: cleanText(input.location, 40),
      tags: normalizeTags(input.tags),
      sort: toInteger(input.sort, 0, -9999, 9999),
      enabled: input.enabled !== false,
      recommended: !!input.recommended,
      image: cleanText(input.image, 500),
      emoji: cleanText(input.emoji, 8) || '📘',
      deleted: false,
      updateTime: db.serverDate()
    };
    if (includeCreateTime) data.createTime = db.serverDate();
    return data;
  }

  // 仅删除云存储文件；http(s) 外链与本地演示路径不处理。
  async function removeCloudFiles(paths) {
    const fileList = (paths || [])
      .map((item) => String(item || ''))
      .filter((item) => item.indexOf('cloud://') === 0 && isSafeCover(item));
    if (!fileList.length || typeof cloud.deleteFile !== 'function') return;
    try {
      await cloud.deleteFile({ fileList });
    } catch (error) {
      // 文件可能已被手动清理，删除失败不应阻塞业务。
      console.warn('[api] 删除云存储文件失败', error && (error.errMsg || error.message));
    }
  }

  async function getBook(openid, payload) {
    const event = payload || {};
    const id = cleanText(event.bookId || event.id, 64);
    assert(id, '缺少图书标识');
    const book = await store.getById(collections.books, id);
    assert(book && !book.deleted, '图书不存在或已下架', 'NOT_FOUND');
    // 未上架图书仅管理员可预览。游客返回「不存在」，
    // 否则可以拿 bookId 探测出哪些书只是被下架了。
    if (book.enabled === false && !(await isAdmin(openid))) {
      throw new AppError('NOT_FOUND', '图书不存在或已下架');
    }
    const category = await store.getById(collections.categories, book.categoryId);
    return {
      book: Object.assign({}, book, {
        image: book.image || '',
        tags: Array.isArray(book.tags) ? book.tags : []
      }),
      categoryName: (category && category.name) || '未分类'
    };
  }

  async function saveBook(openid, event) {
    await requireAdmin(openid);
    const input = (event && event.book) || {};
    const id = cleanText(input._id || event.bookId, 64);
    const data = bookData(input, !id);

    const category = await store.getById(collections.categories, data.categoryId);
    assert(category && !category.deleted, '分类不存在或已删除，请刷新后重试');

    if (id) {
      const existing = await store.getById(collections.books, id);
      assert(existing && !existing.deleted, '图书不存在', 'NOT_FOUND');
      data.sales = Number(existing.sales || 0);
      data.updateBy = openid;
      await store.writeCollection(collections.books, (col) => col.doc(id).update({ data }));
      // 封面被替换后删除旧文件，避免云存储产生孤儿文件。
      if (existing.image && existing.image !== data.image) await removeCloudFiles([existing.image]);
      invalidateCategoryCounts();
      return Object.assign({ _id: id }, existing, data);
    }

    data.sales = 0;
    data.createBy = openid;
    const result = await store.writeCollection(collections.books, (col) => col.add({ data }));
    invalidateCategoryCounts();
    return Object.assign({ _id: result._id }, data);
  }

  async function deleteBook(openid, event) {
    await requireAdmin(openid);
    const id = cleanText(event.bookId, 64);
    assert(id, '缺少图书标识');
    const book = await store.getById(collections.books, id);
    assert(book && !book.deleted, '图书不存在', 'NOT_FOUND');
    await store.writeCollection(collections.books, (col) => col.doc(id).update({
      data: { deleted: true, enabled: false, image: '', updateTime: db.serverDate() }
    }));
    if (book.image) await removeCloudFiles([book.image]);
    invalidateCategoryCounts();
    return { success: true };
  }

  // 只改上架字段：早期版本整条回写，而列表不含长简介，
  // 结果上下架一次就把图书介绍清空了。
  async function setBookStatus(openid, event) {
    await requireAdmin(openid);
    const id = cleanText(event.bookId, 64);
    assert(id, '缺少图书标识');
    const book = await store.getById(collections.books, id);
    assert(book && !book.deleted, '图书不存在', 'NOT_FOUND');
    const enabled = !!event.enabled;
    await store.writeCollection(collections.books, (col) => col.doc(id).update({
      data: { enabled, updateTime: db.serverDate(), updateBy: openid }
    }));
    invalidateCategoryCounts();
    return { _id: id, enabled };
  }

  async function getMenu(openid, payload) {
    const event = payload || {};
    const includeDisabled = !!event.includeDisabled;
    if (includeDisabled) await requireAdmin(openid);
    const { page, pageSize, skip } = parsePaging(event, 50);

    // 停用分类只影响入口是否展示，它下面的图书仍要在「全部」里查得到。
    const allCategories = await store.getAll(collections.categories, { deleted: _.neq(true) }, 'sort', 'asc', 200);
    const categories = includeDisabled ? allCategories : allCategories.filter((item) => item.enabled !== false);

    const requestedCategoryId = cleanText(event.categoryId, 64);
    const categoryIds = allCategories.map((item) => item._id);
    const visibleCategoryIds = categories.map((item) => item._id);
    const where = buildBookWhere({
      includeDisabled,
      categoryId: requestedCategoryId,
      keyword: cleanText(event.keyword, 30)
    });

    const emptyMenu = async () => ({
      categories,
      books: [],
      settings: await ensureSettings(),
      total: 0,
      page,
      pageSize,
      hasMore: false,
      categoryCounts: {},
      demo: false
    });

    if (!includeDisabled && requestedCategoryId && visibleCategoryIds.indexOf(requestedCategoryId) === -1) {
      // 请求了不存在或已停用的分类，返回空页。
      return emptyMenu();
    }
    // 分类为空时不过滤，否则首页一片空白。
    let effectiveWhere = where;
    if (!includeDisabled && !requestedCategoryId && categoryIds.length) {
      effectiveWhere = _.and([where, { categoryId: _.in(categoryIds) }]);
    }

    // 多取一条判断是否有下一页，省掉每页一次的 count()。
    // total 为 -1 表示未统计，只有最后一页能算准（skip + 本页条数）。
    const [rawList, settings, categoryCounts] = await Promise.all([
      queryBooks(effectiveWhere, skip, pageSize + 1),
      ensureSettings(),
      store.getCategoryCounts(includeDisabled)
    ]);
    const hasMore = rawList.length > pageSize;
    const books = hasMore ? rawList.slice(0, pageSize) : rawList;

    return {
      categories,
      books,
      settings,
      total: hasMore ? -1 : skip + books.length,
      page,
      pageSize,
      hasMore,
      categoryCounts,
      demo: false
    };
  }

  async function listBooks(openid, payload) {
    const event = payload || {};
    await requireAdmin(openid);
    const { page, pageSize, skip } = parsePaging(event, 20);
    const rawCategoryId = cleanText(event.categoryId, 64);
    const where = buildBookWhere({
      includeDisabled: true,
      categoryId: rawCategoryId === 'all' ? '' : rawCategoryId,
      keyword: cleanText(event.keyword, 30)
    });

    // 后台页头要显示精确总数，这里保留 count()。
    const [list, total] = await Promise.all([
      queryBooks(where, skip, pageSize),
      store.countWhere(collections.books, where)
    ]);

    const categoryCounts = event.keyword || (event.categoryId && event.categoryId !== 'all')
      ? {}
      : await store.getCategoryCounts(true);

    return { list, total, page, pageSize, hasMore: skip + list.length < total, categoryCounts };
  }

  return {
    buildBookWhere,
    queryBooks,
    bookData,
    getBook,
    saveBook,
    deleteBook,
    setBookStatus,
    getMenu,
    listBooks
  };
}

module.exports = { createBookService };
