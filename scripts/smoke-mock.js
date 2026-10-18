const assert = require('node:assert/strict');
const store = {};

global.wx = {
  getStorageSync(key) {
    return store[key];
  },
  setStorageSync(key, value) {
    store[key] = JSON.parse(JSON.stringify(value));
  },
  removeStorageSync(key) {
    delete store[key];
  }
};

const mock = require('../miniprogram/utils/mock');

(async () => {
  const login = await mock.request('login', {});
  assert.equal(login.user.role, 'customer');
  assert.equal(login.isAdmin, false);

  await assert.rejects(() => mock.request('saveBook', { book: { name: 'x', categoryId: 'y' } }), 'non-admin should be blocked from admin write APIs');
  await assert.rejects(() => mock.request('getMenu', { includeDisabled: true }), 'non-admin should not read disabled list');
  await assert.rejects(() => mock.request('listBooks', {}), 'non-admin should not list admin books');

  const claimed = await mock.request('claimAdmin', { token: mock.SETUP_TOKEN });
  assert.equal(claimed.isAdmin, true);
  assert.equal(claimed.user.role, 'admin');

  const menu = await mock.request('getMenu', {});
  assert.ok(menu.categories.length >= 3);
  assert.ok(menu.books.length >= 1);
  assert.equal(menu.demo, true);
  assert.equal(menu.total, 8);
  assert.ok(menu.categoryCounts[menu.categories[0]._id] >= 1);

  const first = menu.books[0];
  assert.ok(first.name);
  assert.ok(first.author, 'list payload should expose author');

  const detail = await mock.request('getBook', { bookId: first._id });
  assert.equal(detail.book._id, first._id);
  assert.ok(detail.book.intro.length > 10, 'detail should include full intro');
  assert.ok(detail.categoryName);

  const created = await mock.request('saveBook', {
    book: {
      categoryId: menu.categories[0]._id,
      name: '测试图书',
      author: '测试作者',
      publisher: '测试出版社',
      isbn: '978-7-111-54493-7',
      publishYear: 2024,
      pages: 320,
      description: '用于冒烟测试',
      intro: '这是一段较长的图书介绍。\n第二段内容。',
      price: 2500,
      stock: 3,
      location: 'D区-01-01',
      tags: '测试、自动化',
      enabled: true,
      recommended: false,
      image: 'cloud://demo/book-covers/cover.jpg',
      emoji: '📘'
    }
  });
  assert.equal(created.book.name, '测试图书');
  assert.equal(created.book.price, 2500);
  assert.equal(created.book.deleted, false);
  assert.deepEqual(created.book.tags, ['测试', '自动化']);

  await assert.rejects(
    () => mock.request('saveBook', { book: Object.assign({}, created.book, { isbn: 'abc' }) }),
    'invalid ISBN should be rejected'
  );
  await assert.rejects(
    () => mock.request('saveBook', { book: Object.assign({}, created.book, { categoryId: 'missing' }) }),
    'unknown category should be rejected'
  );

  const disabled = await mock.request('setBookStatus', { bookId: created.book._id, enabled: false });
  assert.equal(disabled.enabled, false);
  const afterStatus = await mock.request('getBook', { bookId: created.book._id });
  assert.equal(afterStatus.book.enabled, false);
  assert.ok(afterStatus.book.intro, 'status update must not wipe intro');

  const paged = await mock.request('listBooks', { page: 1, pageSize: 3 });
  assert.equal(paged.list.length, 3);
  assert.equal(paged.total, 9);
  assert.equal(paged.hasMore, true);

  const lastPage = await mock.request('listBooks', { page: 4, pageSize: 3 });
  assert.equal(lastPage.list.length, 0);
  assert.equal(lastPage.hasMore, false);

  const searched = await mock.request('listBooks', { keyword: '余华' });
  assert.equal(searched.total, 1);
  assert.equal(searched.list[0].name, '活着');

  const menuSearch = await mock.request('getMenu', { keyword: '霍金' });
  assert.equal(menuSearch.total, 1);

  await mock.request('deleteBook', { bookId: created.book._id });
  const afterDelete = await mock.request('listBooks', { keyword: '测试图书' });
  assert.equal(afterDelete.total, 0);

  const category = await mock.request('saveCategory', { category: { name: '测试分类', sort: 99, enabled: true } });
  assert.equal(category.category.name, '测试分类');

  await mock.request('deleteCategory', { categoryId: category.category._id });
  const categories = await mock.request('getCategories', { includeDisabled: true });
  assert.ok(!categories.categories.some((item) => item._id === category.category._id));

  const settings = await mock.request('updateSettings', { settings: { libraryName: '测试图书馆', openHours: '09:00-21:00' } });
  assert.equal(settings.settings.libraryName, '测试图书馆');

  const health = await mock.request('systemHealth', {});
  assert.equal(health.demo, true);
  assert.ok(health.checks.length >= 6);
  assert.ok(health.collections.books.count >= 1);

  const users = await mock.request('adminListUsers', {});
  assert.equal(users.total, 1);

  const reset = await mock.request('resetDemoData', {});
  assert.equal(reset.seeded, true);
  assert.equal(reset.books, 8);
  const afterReset = await mock.request('listBooks', { pageSize: 100 });
  assert.equal(afterReset.total, 8);

  const status = await mock.request('adminStatus', {});
  assert.equal(status.adminInitialized, true);

  process.stdout.write('mock smoke test passed\n');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
