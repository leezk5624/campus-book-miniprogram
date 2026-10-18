/**
 * 统一业务云函数。
 *
 * 各集合权限设为「所有用户不可读写」，数据只能经本函数访问；
 * 写操作用 requireAdmin(openid) 鉴权，openid 由云开发注入，前端伪造不了。
 *
 * 本文件只负责组装 lib/ 下的模块并把 action 路由过去。
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

const {
  COLLECTIONS,
  WRITE_ACTIONS,
  SENSITIVE_ACTIONS,
  RATE_WINDOW_MS,
  RATE_MAX
} = require('./lib/constants');
const { AppError, assert } = require('./lib/errors');
const { cleanText } = require('./lib/validate');
const { createStore } = require('./lib/store');
const { createRateLimiter } = require('./lib/rate-limit');
const { createSeedService } = require('./lib/seed');
const { createUserService } = require('./lib/users');
const { createSettingsService } = require('./lib/settings');
const { createBookService } = require('./lib/books');
const { createCategoryService } = require('./lib/categories');
const { createAuditService } = require('./lib/audit');
const { createSystemService } = require('./lib/system');

const store = createStore({ db, _, $, collections: COLLECTIONS });
const rateLimiter = createRateLimiter({
  windowMs: RATE_WINDOW_MS,
  max: RATE_MAX,
  sensitive: SENSITIVE_ACTIONS,
  actions: WRITE_ACTIONS
});
const seed = createSeedService({ db, _, store, collections: COLLECTIONS });
const users = createUserService({
  db, _, store,
  collections: COLLECTIONS,
  seedDefaultData: seed.seedDefaultData
});
const settings = createSettingsService({
  db, store,
  collections: COLLECTIONS,
  requireAdmin: users.requireAdmin
});
const books = createBookService({
  db, _, cloud, store,
  collections: COLLECTIONS,
  requireAdmin: users.requireAdmin,
  isAdmin: users.isAdmin,
  ensureSettings: settings.ensureSettings,
  invalidateCategoryCounts: store.invalidateCategoryCounts
});
const categories = createCategoryService({
  db, _, store,
  collections: COLLECTIONS,
  requireAdmin: users.requireAdmin,
  invalidateCategoryCounts: store.invalidateCategoryCounts
});
const audit = createAuditService({
  db, store,
  collections: COLLECTIONS,
  requireAdmin: users.requireAdmin
});
const system = createSystemService({
  db, _, store,
  collections: COLLECTIONS,
  requireAdmin: users.requireAdmin,
  ensureSettings: settings.ensureSettings,
  listAuditLogs: audit.adminListAuditLogs
});

async function resetDemoData(openid) {
  await users.requireAdmin(openid);
  const result = await seed.seedDefaultData(true);
  store.invalidateCategoryCounts();
  return result;
}

async function route(action, event, openid) {
  switch (action) {
    case 'login': {
      await settings.ensureSettings();
      await users.getUser(openid);
      const user = await users.updateUserProfile(openid, event.profile);
      return { user, isAdmin: user.role === 'admin' && user.enabled !== false, demo: false };
    }
    case 'getMenu':
      return books.getMenu(openid, event);
    case 'getBook':
      return books.getBook(openid, event);
    case 'getCategories':
      return categories.getCategories(openid, event);
    case 'listBooks':
      return books.listBooks(openid, event);
    case 'getSettings':
      return { settings: await settings.ensureSettings(), demo: false };
    case 'saveBook':
      return { book: await books.saveBook(openid, event) };
    case 'deleteBook':
      return books.deleteBook(openid, event);
    case 'setBookStatus':
      return books.setBookStatus(openid, event);
    case 'saveCategory':
      return { category: await categories.saveCategory(openid, event) };
    case 'deleteCategory':
      return categories.deleteCategory(openid, event);
    case 'updateSettings':
      return { settings: await settings.updateSettings(openid, event) };
    case 'resetDemoData':
      return resetDemoData(openid);
    case 'claimAdmin':
      return users.claimAdmin(openid, event);
    case 'adminStatus':
      return users.adminStatus();
    case 'systemHealth':
      return system.systemHealth(openid);
    case 'adminListUsers':
      return users.adminListUsers(openid, event);
    case 'adminListAuditLogs':
      return audit.adminListAuditLogs(openid, event);
    case 'updateUserRole':
      return users.updateUserRole(openid, event);
    default:
      throw new AppError('UNKNOWN_ACTION', '不支持的操作：' + action);
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  try {
    assert(openid, '无法识别当前微信用户', 'UNAUTHORIZED');
    await store.ensureCollections();
    const action = cleanText(event && event.action, 30);
    rateLimiter.hit(openid, action);
    const result = await route(action, event || {}, openid);
    if (WRITE_ACTIONS.has(action)) await audit.writeAuditLog(openid, action, event || {});
    return { ok: true, data: result };
  } catch (error) {
    // 业务异常（AppError）把可读信息返回给前端，其余一律返回通用文案。
    console.error('[api]', event && event.action, error);
    return {
      ok: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error instanceof AppError ? error.message : '服务暂时不可用，请稍后重试'
      }
    };
  }
};
