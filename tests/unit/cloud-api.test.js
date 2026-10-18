'use strict';

// 云函数集成测试：用内存版 SDK 加载 index.js 跑一遍，
// 覆盖模块拼装这一层——拼错的话线上是所有接口一起挂。

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const Module = require('module');

const { createFakeCloud } = require('../helpers/fake-cloud');

const API_DIR = path.resolve(__dirname, '..', '..', 'cloudfunctions', 'api');
const STUB = path.resolve(__dirname, '..', 'helpers', 'wx-server-sdk-stub.js');
const OPENID = 'openid_test_admin';

function loadApi(fake) {
  require.cache[STUB] = {
    id: STUB,
    filename: STUB,
    loaded: true,
    exports: fake,
    children: [],
    paths: []
  };
  const original = Module._resolveFilename;
  Module._resolveFilename = function (request) {
    if (request === 'wx-server-sdk') return STUB;
    return original.apply(this, arguments);
  };
  try {
    // 每个用例都重新加载：集合检查标记、限流桶、分类计数缓存都是模块级状态。
    Object.keys(require.cache)
      .filter((key) => key.indexOf(API_DIR) === 0)
      .forEach((key) => delete require.cache[key]);
    return require(path.join(API_DIR, 'index.js'));
  } finally {
    Module._resolveFilename = original;
  }
}

async function setupAdmin() {
  process.env.ADMIN_SETUP_TOKEN = 'TESTTOKEN';
  const fake = createFakeCloud({ openid: OPENID });
  const api = loadApi(fake);
  const claimed = await api.main({ action: 'claimAdmin', token: 'TESTTOKEN' });
  assert.equal(claimed.ok, true, JSON.stringify(claimed));
  return { api, fake };
}

test('认领管理员后种子数据落库，首页能查到图书', async () => {
  const { api } = await setupAdmin();
  const result = await api.main({ action: 'getMenu', page: 1, pageSize: 5 });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.data.books.length, 5);
  assert.equal(result.data.categories.length, 3);
  assert.equal(result.data.hasMore, true);
  // 未翻到最后一页时不做 count()，总数标记为「未统计」。
  assert.equal(result.data.total, -1);
});

test('前台列表翻到最后一页才回填精确总数，全程不触发 count', async () => {
  const { api } = await setupAdmin();
  const tail = await api.main({ action: 'getMenu', page: 2, pageSize: 5 });
  assert.equal(tail.ok, true, JSON.stringify(tail));
  assert.equal(tail.data.books.length, 3);
  assert.equal(tail.data.hasMore, false);
  assert.equal(tail.data.total, 8);
});

test('封面 fileID 必须落在 book-covers 目录下', async () => {
  const { api } = await setupAdmin();
  const categories = await api.main({ action: 'getCategories' });
  const categoryId = categories.data.categories[0]._id;

  const bad = await api.main({
    action: 'saveBook',
    book: { name: '越权封面', categoryId, price: 100, image: 'cloud://env.abc/private/secret.png' }
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.error.code, 'INVALID_PARAM');

  const good = await api.main({
    action: 'saveBook',
    book: { name: '正常封面', categoryId, price: 100, image: 'cloud://env.abc/book-covers/2026-10/a.png' }
  });
  assert.equal(good.ok, true, JSON.stringify(good));
  assert.equal(good.data.book.image, 'cloud://env.abc/book-covers/2026-10/a.png');
});

test('管理员操作日志回传前去掉明文 openid', async () => {
  const { api, fake } = await setupAdmin();
  const categories = await api.main({ action: 'getCategories' });
  await api.main({
    action: 'saveBook',
    book: { name: '审计测试', categoryId: categories.data.categories[0]._id, price: 0 }
  });
  const logs = await api.main({ action: 'adminListAuditLogs', page: 1, pageSize: 10 });
  assert.equal(logs.ok, true, JSON.stringify(logs));
  assert.ok(logs.data.list.length >= 2);
  logs.data.list.forEach((item) => {
    assert.equal(item.openid, undefined);
    assert.ok(item.openidMask && item.openidMask.indexOf('****') !== -1);
  });
  // 库里存的是明文，脱敏只发生在出参。
  const stored = Object.keys(fake.state.auditLogs).map((id) => fake.state.auditLogs[id]);
  assert.ok(stored.some((row) => row.openid === OPENID));
});

test('普通用户调用管理接口被拒绝，且错误信封不带内部细节', async () => {
  const fake = createFakeCloud({ openid: 'openid_guest' });
  const api = loadApi(fake);
  const result = await api.main({ action: 'listBooks', page: 1, pageSize: 20 });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'FORBIDDEN');
  assert.equal(result.error.message, '当前账号没有管理员权限');
});

test('未知 action 返回明确错误', async () => {
  const { api } = await setupAdmin();
  const result = await api.main({ action: 'listBorrowRecords' });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'UNKNOWN_ACTION');
});

test('下架的图书对普通用户不可见，管理员仍可预览', async () => {
  const { api, fake } = await setupAdmin();
  const listed = await api.main({ action: 'listBooks', page: 1, pageSize: 50 });
  const target = listed.data.list[0];
  await api.main({ action: 'setBookStatus', bookId: target._id, enabled: false });

  // 复用同一份数据，换个身份再看同一本书。
  const guestApi = loadApi(createFakeCloud({ openid: 'openid_guest', state: fake.state }));
  const guestView = await guestApi.main({ action: 'getBook', bookId: target._id });
  assert.equal(guestView.ok, false);
  assert.equal(guestView.error.code, 'NOT_FOUND');

  const adminView = await api.main({ action: 'getBook', bookId: target._id });
  assert.equal(adminView.ok, true, JSON.stringify(adminView));
  assert.equal(adminView.data.book._id, target._id);
});
