const STORAGE_KEY = 'campus_book_mock_state_v1';
const STATE_VERSION = 3;
const SETUP_TOKEN = 'DEMO8888';

function now() {
  return new Date().toISOString();
}

function seedState() {
  const createdAt = now();
  return {
    version: STATE_VERSION,
    currentUser: null,
    adminClaimed: false,
    auditLogs: [],
    settings: {
      _id: 'library',
      libraryName: '校园图书管理系统',
      notice: '本页面为演示数据，图书与分类均可自由修改',
      address: '请在管理后台填写图书馆地址',
      phone: '13800000000',
      openHours: '08:00-22:00',
      updateTime: createdAt
    },
    categories: [
      { _id: 'cat_lit', name: '文学小说', sort: 1, enabled: true, createTime: createdAt },
      { _id: 'cat_sci', name: '科学技术', sort: 2, enabled: true, createTime: createdAt },
      { _id: 'cat_text', name: '教材教辅', sort: 3, enabled: true, createTime: createdAt }
    ],
    books: [
      {
        _id: 'book_1', categoryId: 'cat_lit', name: '活着', author: '余华', publisher: '作家出版社', isbn: '9787506365437',
        publishYear: 2012, pages: 191, price: 3500, originalPrice: 4500, stock: 3, sales: 12, location: 'A区-01-03',
        description: '余华代表作，讲述普通人在时代中的坚韧与温情',
        intro: '《活着》讲述了农村人福贵悲惨的人生遭遇。小说以平静的叙述写出生命的承受力，是余华最具代表性的作品之一。',
        tags: ['当代文学', '长篇小说'], enabled: true, recommended: true, image: '', emoji: '📕', sort: 1, updateTime: createdAt
      },
      {
        _id: 'book_2', categoryId: 'cat_lit', name: '平凡的世界', author: '路遥', publisher: '北京十月文艺出版社', isbn: '9787530216781',
        publishYear: 2017, pages: 1631, price: 9800, originalPrice: 0, stock: 2, sales: 8, location: 'A区-01-05',
        description: '路遥长篇小说，描写普通人的奋斗与生活',
        intro: '以孙少安、孙少平兄弟为中心，全景式描写中国当代城乡社会生活。',
        tags: ['当代文学', '茅盾文学奖'], enabled: true, recommended: true, image: '', emoji: '📗', sort: 2, updateTime: createdAt
      },
      {
        _id: 'book_3', categoryId: 'cat_lit', name: '围城', author: '钱钟书', publisher: '人民文学出版社', isbn: '9787020090006',
        publishYear: 1991, pages: 359, price: 3200, originalPrice: 0, stock: 4, sales: 5, location: 'A区-02-01',
        description: '钱钟书经典小说，语言幽默犀利',
        intro: '以方鸿渐的求学、谋职与婚姻为主线，描绘抗战初期知识分子的众生相。',
        tags: ['现代文学', '讽刺小说'], enabled: true, recommended: false, image: '', emoji: '📙', sort: 3, updateTime: createdAt
      },
      {
        _id: 'book_4', categoryId: 'cat_sci', name: '时间简史', author: '史蒂芬·霍金', publisher: '湖南科学技术出版社', isbn: '9787535732309',
        publishYear: 2010, pages: 236, price: 4500, originalPrice: 0, stock: 5, sales: 9, location: 'B区-03-02',
        description: '霍金科普经典，带你认识宇宙的奥秘',
        intro: '从大爆炸到黑洞，霍金用通俗的语言介绍宇宙的起源与命运。',
        tags: ['科普', '物理学'], enabled: true, recommended: true, image: '', emoji: '📘', sort: 1, updateTime: createdAt
      },
      {
        _id: 'book_5', categoryId: 'cat_sci', name: '人类简史', author: '尤瓦尔·赫拉利', publisher: '中信出版社', isbn: '9787508647357',
        publishYear: 2014, pages: 440, price: 6800, originalPrice: 0, stock: 4, sales: 7, location: 'B区-04-01',
        description: '从认知革命到科技革命，重新理解人类文明',
        intro: '以认知革命、农业革命、科学革命三条主线重构人类历史。',
        tags: ['历史', '社会科学'], enabled: true, recommended: false, image: '', emoji: '📔', sort: 2, updateTime: createdAt
      },
      {
        _id: 'book_6', categoryId: 'cat_sci', name: '深入理解计算机系统', author: 'Randal E. Bryant', publisher: '机械工业出版社', isbn: '9787111544937',
        publishYear: 2016, pages: 737, price: 12800, originalPrice: 0, stock: 2, sales: 4, location: 'C区-01-01',
        description: '计算机专业经典教材，讲解底层原理',
        intro: '从程序员视角讲解计算机系统：数据表示、汇编、处理器、存储层次与并发编程。',
        tags: ['计算机', '教材'], enabled: true, recommended: false, image: '', emoji: '💻', sort: 3, updateTime: createdAt
      },
      {
        _id: 'book_7', categoryId: 'cat_text', name: '高等数学（上册）', author: '同济大学数学系', publisher: '高等教育出版社', isbn: '9787040396638',
        publishYear: 2014, pages: 423, price: 4200, originalPrice: 0, stock: 20, sales: 15, location: 'C区-02-04',
        description: '理工科通用教材，配套习题丰富',
        intro: '内容包括函数与极限、导数与微分、不定积分、定积分及其应用、微分方程等。',
        tags: ['数学', '教材'], enabled: true, recommended: true, image: '', emoji: '📐', sort: 1, updateTime: createdAt
      },
      {
        _id: 'book_8', categoryId: 'cat_text', name: '大学英语四级真题', author: '新东方考试研究中心', publisher: '浙江教育出版社', isbn: '9787553681254',
        publishYear: 2020, pages: 320, price: 3600, originalPrice: 0, stock: 15, sales: 11, location: 'C区-03-02',
        description: '历年真题汇编，备考必备',
        intro: '收录历年大学英语四级考试真题及解析，按题型分类训练。',
        tags: ['英语', '考试'], enabled: true, recommended: false, image: '', emoji: '📝', sort: 2, updateTime: createdAt
      }
    ]
  };
}

function getState() {
  let state = wx.getStorageSync(STORAGE_KEY);
  if (!state || state.version !== STATE_VERSION) {
    state = seedState();
    saveState(state);
  }
  return state;
}

function saveState(state) {
  wx.setStorageSync(STORAGE_KEY, state);
}

function reset() {
  const state = seedState();
  saveState(state);
  return state;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function cleanText(value, maxLength) {
  const text = String(value === null || value === undefined ? '' : value).trim();
  const limit = maxLength || 200;
  const chars = Array.from(text);
  return chars.length > limit ? chars.slice(0, limit).join('') : text;
}

function toInteger(value, fallback, min, max) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

// 封面校验规则与云函数 lib/validate.js 的 isSafeCover 保持一致：
// 两边一旦分叉，mock 里能存的脏数据到了云端会被拒。
function isSafeCover(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  if (/^https?:\/\//i.test(text)) return text.length <= 500;
  // mock 模式下封面落在本地临时目录，形如 http://usr/ 或 wxfile://usr/
  if (/^(wxfile|http):\/\/usr\//.test(text)) return true;
  if (text.indexOf('cloud://') !== 0) return false;
  const body = text.slice('cloud://'.length);
  const slash = body.indexOf('/');
  if (slash === -1) return false;
  const path = body.slice(slash + 1);
  if (path.indexOf('..') !== -1) return false;
  return path.indexOf('book-covers/') === 0 && path.length <= 300;
}

function normalizeTags(input) {
  const raw = Array.isArray(input) ? input : String(input || '').split(/[,，、;；\s]+/);
  const seen = {};
  const tags = [];
  raw.forEach((item) => {
    const tag = cleanText(item, 12);
    if (!tag || seen[tag]) return;
    seen[tag] = true;
    if (tags.length < 8) tags.push(tag);
  });
  return tags;
}

function categoryMap(state) {
  const map = {};
  state.categories.forEach((item) => {
    if (!item.deleted) map[item._id] = item;
  });
  return map;
}

function sortBooks(list) {
  return list.slice().sort((a, b) => {
    const sortDiff = Number(a.sort || 0) - Number(b.sort || 0);
    if (sortDiff !== 0) return sortDiff;
    return String(b.updateTime || '').localeCompare(String(a.updateTime || ''));
  });
}

function matchKeyword(book, keyword) {
  if (!keyword) return true;
  const query = keyword.toLowerCase();
  return [book.name, book.author, book.isbn, book.description]
    .some((value) => String(value || '').toLowerCase().indexOf(query) >= 0);
}

function bookPage(state, options) {
  const categories = categoryMap(state);
  const pageSize = Math.max(1, Math.min(Number(options.pageSize) || 50, 100));
  const page = Math.max(1, Number(options.page) || 1);
  let list = state.books.filter((item) => {
    if (item.deleted) return false;
    if (!options.includeDisabled && item.enabled === false) return false;
    if (!options.includeDisabled && !categories[item.categoryId]) return false;
    if (options.categoryId && item.categoryId !== options.categoryId) return false;
    return matchKeyword(item, options.keyword);
  });
  list = sortBooks(list);
  const total = list.length;
  const start = (page - 1) * pageSize;
  return {
    list: clone(list.slice(start, start + pageSize)),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total
  };
}

function categoryCounts(state, includeDisabled) {
  const counts = {};
  state.books.forEach((item) => {
    if (item.deleted) return;
    if (!includeDisabled && item.enabled === false) return;
    counts[item.categoryId] = (counts[item.categoryId] || 0) + 1;
  });
  return counts;
}

function publicCategories(state, includeDisabled) {
  return state.categories
    .filter((item) => !item.deleted && (includeDisabled || item.enabled !== false))
    .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
}

function delay(value) {
  return new Promise((resolve) => setTimeout(() => resolve(clone(value)), 100));
}

function maskIdentifier(id) {
  const text = String(id || '');
  if (text.length <= 8) return text ? text.slice(0, 2) + '****' : '';
  return text.slice(0, 5) + '****' + text.slice(-4);
}

// 与云函数保持一致的写操作集合，用于统一记录审计日志。
const WRITE_ACTIONS = new Set([
  'saveBook', 'deleteBook', 'setBookStatus',
  'saveCategory', 'deleteCategory',
  'updateSettings', 'resetDemoData', 'claimAdmin', 'updateUserRole'
]);

function auditDetail(action, data) {
  if (action === 'saveBook') {
    return (data.book && data.book._id ? '修改 ' : '新增 ') + ((data.book && data.book.name) || '');
  }
  if (action === 'deleteBook') return '删除 ' + cleanText(data.bookId, 64);
  if (action === 'setBookStatus') return (data.enabled ? '上架 ' : '下架 ') + cleanText(data.bookId, 64);
  if (action === 'saveCategory') {
    return (data.category && data.category._id ? '修改分类 ' : '新增分类 ') + ((data.category && data.category.name) || '');
  }
  if (action === 'deleteCategory') return '删除分类 ' + cleanText(data.categoryId, 64);
  if (action === 'updateUserRole') return cleanText(data.userId, 64) + ' → ' + cleanText(data.role, 16);
  if (action === 'updateSettings') return '更新系统配置';
  if (action === 'resetDemoData') return '重置示例数据';
  if (action === 'claimAdmin') return '绑定管理员';
  return '';
}

function requireAdminState(state) {
  if (!state.currentUser || state.currentUser.role !== 'admin' || state.currentUser.enabled === false) {
    throw new Error('当前账号没有管理员权限');
  }
}

function applyBookInput(state, input, id) {
  const name = cleanText(input.name, 60);
  const categoryId = cleanText(input.categoryId, 64);
  if (!name) throw new Error('请填写图书名称');
  if (!categoryId) throw new Error('请选择分类');
  const category = state.categories.find((item) => item._id === categoryId && !item.deleted);
  if (!category) throw new Error('分类不存在或已删除，请刷新后重试');

  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0) throw new Error('定价格式不正确');
  const originalPrice = Number(input.originalPrice);
  if (input.originalPrice && (!Number.isFinite(originalPrice) || originalPrice < 0)) {
    throw new Error('划线价格式不正确');
  }
  const isbn = cleanText(input.isbn, 20).replace(/\s/g, '');
  if (isbn && !/^[0-9Xx-]{10,17}$/.test(isbn)) throw new Error('ISBN 格式不正确');
  if (!isSafeCover(input.image)) throw new Error('封面地址不合法');

  const existing = id ? state.books.find((item) => item._id === id && !item.deleted) : null;
  if (id && !existing) throw new Error('图书不存在');

  return {
    _id: id || createId('book'),
    categoryId,
    name,
    author: cleanText(input.author, 40),
    publisher: cleanText(input.publisher, 60),
    isbn,
    publishYear: toInteger(input.publishYear, 0, 0, new Date().getFullYear() + 1),
    pages: toInteger(input.pages, 0, 0, 100000),
    description: cleanText(input.description, 200),
    intro: cleanText(input.intro, 2000),
    price: Math.round(price),
    originalPrice: Math.round(Number(originalPrice) || 0),
    stock: input.stock === '' || input.stock === null || input.stock === undefined || Number(input.stock) < 0
      ? -1
      : toInteger(input.stock, 0, 0, 100000),
    location: cleanText(input.location, 40),
    tags: normalizeTags(input.tags),
    sort: toInteger(input.sort, 0, -9999, 9999),
    enabled: input.enabled !== false,
    recommended: !!input.recommended,
    image: cleanText(input.image, 500),
    emoji: cleanText(input.emoji, 8) || '📘',
    sales: existing ? Number(existing.sales || 0) : 0,
    deleted: false,
    createTime: existing ? existing.createTime : now(),
    updateTime: now()
  };
}

async function handle(action, payload) {
  const data = payload || {};
  const state = getState();
  const name = action;

  if (name === 'login') {
    if (!state.currentUser) {
      state.currentUser = {
        openid: 'demo_user',
        nickName: '演示用户',
        avatarUrl: '',
        role: 'customer',
        enabled: true,
        createTime: now(),
        lastLoginAt: now()
      };
    } else {
      state.currentUser.lastLoginAt = now();
    }
    saveState(state);
    return delay({
      user: state.currentUser,
      isAdmin: state.currentUser.role === 'admin' && state.currentUser.enabled !== false,
      demo: true
    });
  }

  if (name === 'getCategories') {
    if (data.includeDisabled) requireAdminState(state);
    return delay({ categories: clone(publicCategories(state, !!data.includeDisabled)) });
  }

  if (name === 'getMenu') {
    if (data.includeDisabled) requireAdminState(state);
    const includeDisabled = !!data.includeDisabled;
    const categories = publicCategories(state, includeDisabled);
    const page = bookPage(state, {
      includeDisabled,
      categoryId: cleanText(data.categoryId, 64),
      keyword: cleanText(data.keyword, 30),
      page: data.page,
      pageSize: data.pageSize
    });
    return delay({
      categories: clone(categories),
      books: page.list,
      settings: clone(state.settings),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      hasMore: page.hasMore,
      categoryCounts: categoryCounts(state, includeDisabled),
      demo: true
    });
  }

  if (name === 'listBooks') {
    requireAdminState(state);
    const categoryId = cleanText(data.categoryId, 64);
    const page = bookPage(state, {
      includeDisabled: true,
      categoryId: categoryId === 'all' ? '' : categoryId,
      keyword: cleanText(data.keyword, 30),
      page: data.page,
      pageSize: data.pageSize || 20
    });
    return delay({
      list: page.list,
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      hasMore: page.hasMore,
      categoryCounts: categoryId || data.keyword ? {} : categoryCounts(state, true)
    });
  }

  if (name === 'getBook') {
    const id = cleanText(data.bookId || data.bookId || data.id, 64);
    const book = state.books.find((item) => item._id === id && !item.deleted);
    if (!book) throw new Error('图书不存在或已下架');
    if (book.enabled === false) requireAdminState(state);
    const category = state.categories.find((item) => item._id === book.categoryId);
    return delay({ book: clone(book), categoryName: (category && category.name) || '未分类' });
  }

  if (name === 'getSettings') {
    return delay({ settings: state.settings, demo: true });
  }

  if (name === 'saveBook') {
    requireAdminState(state);
    const input = data.book || data.book || {};
    const id = cleanText(input._id, 64);
    const book = applyBookInput(state, input, id);
    const index = state.books.findIndex((item) => item._id === book._id);
    if (index >= 0) state.books[index] = book;
    else state.books.push(book);
    saveState(state);
    return delay({ book });
  }

  if (name === 'deleteBook') {
    requireAdminState(state);
    const book = state.books.find((item) => item._id === (data.bookId || data.bookId));
    if (!book || book.deleted) throw new Error('图书不存在');
    book.deleted = true;
    book.enabled = false;
    book.image = '';
    saveState(state);
    return delay({ success: true });
  }

  if (name === 'setBookStatus') {
    requireAdminState(state);
    const book = state.books.find((item) => item._id === (data.bookId || data.bookId) && !item.deleted);
    if (!book) throw new Error('图书不存在');
    book.enabled = !!data.enabled;
    book.updateTime = now();
    saveState(state);
    return delay({ _id: book._id, enabled: book.enabled });
  }

  if (name === 'saveCategory') {
    requireAdminState(state);
    const input = data.category || {};
    if (!String(input.name || '').trim()) throw new Error('请填写分类名称');
    const category = {
      _id: input._id || createId('cat'),
      name: String(input.name).trim(),
      sort: toInteger(input.sort, 0, -9999, 9999),
      enabled: input.enabled !== false,
      deleted: false,
      updateTime: now()
    };
    const index = state.categories.findIndex((item) => item._id === category._id);
    if (index >= 0) state.categories[index] = Object.assign({}, state.categories[index], category);
    else state.categories.push(Object.assign({ createTime: now() }, category));
    saveState(state);
    return delay({ category });
  }

  if (name === 'deleteCategory') {
    requireAdminState(state);
    const count = state.books.filter((item) => item.categoryId === data.categoryId && !item.deleted).length;
    if (count > 0) throw new Error('该分类下还有图书，不能删除');
    state.categories = state.categories.filter((item) => item._id !== data.categoryId);
    saveState(state);
    return delay({ success: true });
  }

  if (name === 'updateSettings') {
    requireAdminState(state);
    state.settings = Object.assign({}, state.settings, data.settings || {}, { updateTime: now() });
    saveState(state);
    return delay({ settings: state.settings });
  }

  if (name === 'resetDemoData') {
    requireAdminState(state);
    const fresh = seedState();
    fresh.currentUser = state.currentUser;
    saveState(fresh);
    return delay({ seeded: true, categories: fresh.categories.length, books: fresh.books.length });
  }

  if (name === 'systemHealth') {
    requireAdminState(state);
    const bookCount = state.books.filter((item) => !item.deleted).length;
    const checks = [
      { key: 'cloud', label: '演示数据连接', ok: true, message: '当前使用本地持久化演示模式' },
      { key: 'database', label: '本地数据集合', ok: true, message: '分类、图书和设置数据可用' },
      { key: 'settings', label: '系统配置', ok: !!state.settings.libraryName, message: state.settings.libraryName || '尚未配置' },
      { key: 'books', label: '图书数据', ok: state.categories.length > 0 && bookCount > 0, message: state.categories.length + ' 个分类 · ' + bookCount + ' 本图书' },
      { key: 'admin', label: '管理员权限', ok: true, message: '演示账号拥有管理员权限' },
      { key: 'token', label: '初始化令牌', ok: true, message: '演示令牌：' + SETUP_TOKEN }
    ];
    return delay({
      demo: true,
      checkedAt: now(),
      timezone: 'Asia/Shanghai (UTC+8)',
      envId: 'local-demo',
      admin: { nickName: state.currentUser ? state.currentUser.nickName : '演示管理员', openidMask: 'demo****user' },
      collections: {
        users: { exists: true, count: state.currentUser ? 1 : 0 },
        categories: { exists: true, count: state.categories.length },
        books: { exists: true, count: bookCount },
        settings: { exists: true, count: 1 }
      },
      settings: { libraryName: state.settings.libraryName, openHours: state.settings.openHours },
      config: { setupTokenConfigured: true, cloudEnvConfigured: false },
      checks
    });
  }

  if (name === 'adminStatus') {
    return delay({ adminInitialized: !!(state.currentUser && state.currentUser.role === 'admin') });
  }

  if (name === 'claimAdmin') {
    if (String(data.token || '') !== SETUP_TOKEN) throw new Error('初始化令牌不正确');
    if (!state.currentUser) throw new Error('请先登录');
    if (state.adminClaimed) throw new Error('管理员已经初始化，请联系现有管理员添加权限');
    state.currentUser.role = 'admin';
    state.adminClaimed = true;
    saveState(state);
    return delay({ user: state.currentUser, isAdmin: true });
  }

  if (name === 'adminListUsers') {
    requireAdminState(state);
    const users = [];
    if (state.currentUser) {
      const row = Object.assign({}, state.currentUser, { openidMask: maskIdentifier(state.currentUser.openid) });
      delete row.openid;
      users.push(row);
    }
    return delay({ list: users, total: users.length, page: 1, pageSize: 100, hasMore: false });
  }

  if (name === 'adminListAuditLogs') {
    requireAdminState(state);
    const size = Math.min(Number(data.pageSize) || 20, 50);
    const skip = ((Number(data.page) || 1) - 1) * size;
    const logs = (state.auditLogs || []).map((item) => {
      const row = Object.assign({}, item, { openidMask: maskIdentifier(item.openid) });
      delete row.openid;
      return row;
    });
    return delay({ list: logs.slice(skip, skip + size), total: logs.length, page: Number(data.page) || 1, pageSize: size, hasMore: skip + size < logs.length });
  }

  if (name === 'updateUserRole') {
    requireAdminState(state);
    if (!state.currentUser || state.currentUser.openid !== data.userId) throw new Error('演示模式只能修改当前用户');
    if (data.role !== 'admin' && data.role !== 'customer') throw new Error('无效角色');
    if (state.currentUser.role === 'admin' && data.role === 'customer') throw new Error('至少需要保留一名管理员');
    state.currentUser.role = data.role;
    saveState(state);
    return delay({ user: state.currentUser });
  }

  if (name === 'resetDemo') {
    reset();
    throw new Error('演示数据已重置，请重新进入小程序');
  }

  throw new Error('演示模式暂不支持操作：' + action);
}

// 写操作统一记日志，与云函数行为保持一致。
async function request(action, payload) {
  const result = await handle(action, payload);
  if (!WRITE_ACTIONS.has(action)) return result;
  const state = getState();
  if (!Array.isArray(state.auditLogs)) state.auditLogs = [];
  state.auditLogs.unshift({
    _id: createId('log'),
    openid: (state.currentUser && state.currentUser.openid) || '',
    action,
    detail: auditDetail(action, payload || {}),
    createTime: now()
  });
  if (state.auditLogs.length > 200) state.auditLogs.length = 200;
  saveState(state);
  return result;
}

module.exports = {
  request,
  reset,
  SETUP_TOKEN,
  STATE_VERSION,
  STORAGE_KEY
};
