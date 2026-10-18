const test = require('node:test');
const assert = require('node:assert/strict');

// mock 只依赖 Storage 两个同步方法，测试中替换为内存实现（与 smoke 脚本一致）。
const store = {};
global.wx = {
  getStorageSync(key) {
    return store[key];
  },
  setStorageSync(key, value) {
    store[key] = JSON.parse(JSON.stringify(value));
  }
};

const mock = require('../../miniprogram/utils/mock');

test('游客可读目录，读取下架书目需要管理员', async () => {
  const menu = await mock.request('getMenu', { page: 1, pageSize: 2 });
  assert.equal(menu.books.length <= 2, true);
  assert.equal(menu.hasMore, 2 < menu.total);
  await assert.rejects(() => mock.request('getMenu', { includeDisabled: true }), /管理员权限/);
});

test('写接口对未授权账号关闭', async () => {
  await mock.request('login', {});
  await assert.rejects(() => mock.request('saveBook', { book: { name: 'x', categoryId: 'cat_sci' } }), /管理员权限/);
  await assert.rejects(() => mock.request('listBooks', {}), /管理员权限/);
});

test('认领管理员校验令牌，且不允许重复认领', async () => {
  await assert.rejects(() => mock.request('claimAdmin', { token: 'wrong-token' }), /令牌不正确/);
  const claimed = await mock.request('claimAdmin', { token: mock.SETUP_TOKEN });
  assert.equal(claimed.isAdmin, true);
  await assert.rejects(() => mock.request('claimAdmin', { token: mock.SETUP_TOKEN }), /已经初始化/);
});

test('新增图书进入列表，ISBN 格式错误时被拒绝', async () => {
  const before = await mock.request('listBooks', { page: 1, pageSize: 5 });
  const saved = await mock.request('saveBook', {
    book: { name: '深入理解计算机系统', categoryId: 'cat_sci', price: 13900, isbn: '9787111544937' }
  });
  assert.equal(typeof saved.book._id, 'string');
  const after = await mock.request('listBooks', { page: 1, pageSize: 5 });
  assert.equal(after.total, before.total + 1);
  await assert.rejects(
    () => mock.request('saveBook', { book: { name: '非法 ISBN', categoryId: 'cat_sci', price: 100, isbn: '123' } }),
    /ISBN/
  );
});

test('上下架只改状态，已有介绍不被覆盖', async () => {
  const saved = await mock.request('saveBook', {
    book: { name: '保留介绍的书', categoryId: 'cat_lit', price: 4200, intro: '这段介绍不应丢失' }
  });
  await mock.request('setBookStatus', { bookId: saved.book._id, enabled: false });
  const detail = await mock.request('getBook', { bookId: saved.book._id });
  assert.equal(detail.book.intro, '这段介绍不应丢失');
  assert.equal(detail.book.enabled, false);
});

test('缺少 deleted / enabled 字段的书目在前台仍然可见', async () => {
  // 控制台手工录入或旧版本写入的文档常常没有这两个字段，
  // 等值过滤会把它们整条丢掉，表现为“数据写进去了却查不到”。
  const state = JSON.parse(JSON.stringify(store[mock.STORAGE_KEY]));
  state.books.push({
    _id: 'book_legacy',
    categoryId: 'cat_lit',
    name: '手工录入的书',
    price: 3000,
    sort: 0,
    updateTime: new Date().toISOString()
  });
  store[mock.STORAGE_KEY] = state;

  const menu = await mock.request('getMenu', { page: 1, pageSize: 100 });
  assert.equal((menu.books || []).some((item) => item._id === 'book_legacy'), true);
});

test('管理员写操作记日志，日志只暴露脱敏标识', async () => {
  await mock.request('saveBook', { book: { name: '日志用书', categoryId: 'cat_sci', price: 100 } });
  const logs = await mock.request('adminListAuditLogs', { page: 1, pageSize: 10 });
  assert.equal((logs.list || []).some((item) => /日志用书/.test(item.detail || '')), true);
  (logs.list || []).forEach((item) => {
    assert.equal(item.openid, undefined);
    assert.match(item.openidMask, /\*{4}/);
  });
});

test('封面地址校验与云函数保持一致', async () => {
  // mock 放行而云端拒绝的封面，要切到云环境才发现，属于最晚暴露的一类 bug。
  const base = { name: '封面校验用书', categoryId: 'cat_sci', price: 100 };
  await assert.rejects(
    () => mock.request('saveBook', { book: Object.assign({}, base, { image: 'cloud://env.abc/private/a.png' }) }),
    /封面地址不合法/
  );
  const ok = await mock.request('saveBook', {
    book: Object.assign({}, base, { image: 'cloud://env.abc/book-covers/2026-10/a.png' })
  });
  assert.equal(ok.book.image, 'cloud://env.abc/book-covers/2026-10/a.png');
});

test('用户列表返回脱敏标识而非明文 openid', async () => {
  const result = await mock.request('adminListUsers', {});
  assert.equal(result.list.length > 0, true);
  result.list.forEach((user) => {
    assert.equal(user.openid, undefined);
    assert.match(user.openidMask, /\*{4}/);
  });
});
