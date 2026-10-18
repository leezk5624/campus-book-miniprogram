'use strict';

// 部署自检。把「前台能不能查到书」拆成逐级漏斗，用来定位环境配置问题。

const { isMissingCollection } = require('./errors');
const { maskIdentifier } = require('./validate');
const { LIST_FIELDS } = require('./constants');

function createSystemService(options) {
  const db = options.db;
  const _ = options._;
  const store = options.store;
  const collections = options.collections;
  const requireAdmin = options.requireAdmin;
  const ensureSettings = options.ensureSettings;
  const listAuditLogs = options.listAuditLogs;

  async function countCollection(collectionName) {
    try {
      const result = await db.collection(collectionName).count();
      return { exists: true, count: result.total };
    } catch (error) {
      if (isMissingCollection(error)) return { exists: false, count: 0 };
      throw error;
    }
  }

  // 逐级统计图书可见性：总数 → 未删除 → 已上架 → 所属分类已启用 → 前台实际查询。
  async function bookVisibility() {
    const categories = await store.getAll(collections.categories, { deleted: _.neq(true) }, 'sort', 'asc', 200);
    const enabledIds = categories.filter((item) => item.enabled !== false).map((item) => item._id);
    const report = {
      categories: categories.length,
      enabledCategories: enabledIds.length,
      total: await store.countWhere(collections.books, {}),
      notDeleted: await store.countWhere(collections.books, { deleted: _.neq(true) }),
      enabled: await store.countWhere(collections.books, _.and([{ deleted: _.neq(true) }, { enabled: _.neq(false) }])),
      inEnabledCategory: 0,
      front: 0,
      frontError: ''
    };

    const categoryIds = categories.map((item) => item._id);
    let where = _.and([{ deleted: _.neq(true) }, { enabled: _.neq(false) }]);
    if (categoryIds.length) {
      where = _.and([{ deleted: _.neq(true) }, { enabled: _.neq(false) }, { categoryId: _.in(categoryIds) }]);
      report.inEnabledCategory = await store.countWhere(collections.books, where);
    }

    try {
      const result = await db.collection(collections.books)
        .where(where)
        .field(LIST_FIELDS)
        .orderBy('sort', 'asc')
        .orderBy('updateTime', 'desc')
        .limit(20)
        .get();
      report.front = ((result && result.data) || []).length;
    } catch (error) {
      // 最常见的失败原因是排序缺少索引，把原始报错带回去便于排查。
      report.front = -1;
      report.frontError = String((error && (error.errMsg || error.message)) || '未知错误').slice(0, 160);
    }
    return report;
  }

  async function systemHealth(openid) {
    const admin = await requireAdmin(openid);
    const names = ['users', 'categories', 'books', 'settings', 'auditLogs'];
    const counts = {};
    for (const name of names) counts[name] = await countCollection(collections[name] || name);
    const settings = await ensureSettings();
    const visibility = await bookVisibility();
    const allCollectionsReady = names.every((name) => counts[name].exists);
    const frontOk = visibility.front > 0;
    const checks = [
      { key: 'cloud', label: '云函数连接', ok: true, message: 'api 云函数运行正常' },
      { key: 'database', label: '数据库集合', ok: allCollectionsReady, message: allCollectionsReady ? '5 个核心集合均已创建' : '存在未创建的集合，请按部署文档检查' },
      { key: 'settings', label: '系统配置', ok: !!(settings && settings.libraryName), message: settings && settings.libraryName ? settings.libraryName : '尚未配置图书馆名称' },
      {
        key: 'books',
        label: '图书数据',
        ok: frontOk,
        message: counts.categories.count + ' 个分类 · ' + counts.books.count + ' 本图书 · 前台可见 ' + visibility.front
          + (visibility.frontError ? '（' + visibility.frontError + '）' : '')
      },
      { key: 'admin', label: '管理员权限', ok: true, message: '当前账号已通过服务端鉴权' },
      { key: 'token', label: '初始化令牌', ok: !!process.env.ADMIN_SETUP_TOKEN, message: process.env.ADMIN_SETUP_TOKEN ? '已配置环境变量' : '未配置 ADMIN_SETUP_TOKEN' }
    ];
    return {
      demo: false,
      checkedAt: new Date(),
      timezone: 'Asia/Shanghai (UTC+8)',
      envId: process.env.TCB_ENV || process.env.SCF_NAMESPACE || '动态云环境',
      admin: { nickName: admin.nickName || '管理员', openidMask: maskIdentifier(openid) },
      collections: counts,
      visibility,
      auditLogs: (await listAuditLogs(openid, { page: 1, pageSize: 10 })).list,
      settings: {
        libraryName: (settings && settings.libraryName) || '',
        openHours: (settings && settings.openHours) || ''
      },
      config: {
        setupTokenConfigured: !!process.env.ADMIN_SETUP_TOKEN,
        cloudEnvConfigured: !!(process.env.TCB_ENV || process.env.SCF_NAMESPACE)
      },
      checks
    };
  }

  return { systemHealth, bookVisibility, countCollection };
}

module.exports = { createSystemService };
