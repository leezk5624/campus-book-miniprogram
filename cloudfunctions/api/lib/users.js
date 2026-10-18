'use strict';

// 用户与权限。openid 由云开发注入，前端伪造不了；对外返回一律脱敏。

const { assert, AppError, isMissingCollection, isMissingDocument } = require('./errors');
const { cleanText, maskIdentifier, safeEqual } = require('./validate');
const { parsePaging } = require('./paging');
const { USER_LIST_FIELDS } = require('./constants');

function createUserService(options) {
  const db = options.db;
  const _ = options._;
  const store = options.store;
  const collections = options.collections;
  const seedDefaultData = options.seedDefaultData;

  async function getUser(openid) {
    const ref = db.collection(collections.users).doc(openid);
    let result = null;
    try {
      result = await ref.get();
    } catch (error) {
      if (!isMissingCollection(error) && !isMissingDocument(error)) throw error;
    }
    if (result && result.data) return Object.assign({ _id: openid }, result.data);
    const user = {
      openid,
      nickName: '微信用户',
      avatarUrl: '',
      role: 'customer',
      enabled: true,
      createTime: db.serverDate(),
      lastLoginAt: db.serverDate()
    };
    await store.writeCollection(collections.users, (col) => col.doc(openid).set({ data: user }));
    return Object.assign({ _id: openid }, user);
  }

  async function updateUserProfile(openid, profile) {
    const update = { lastLoginAt: db.serverDate() };
    if (profile && typeof profile === 'object') {
      if (profile.nickName) update.nickName = cleanText(profile.nickName, 30);
      if (profile.avatarUrl) update.avatarUrl = cleanText(profile.avatarUrl, 500);
    }
    await store.writeCollection(collections.users, (col) => col.doc(openid).update({ data: update }));
    return getUser(openid);
  }

  // 只判断身份，不抛错。需要「对游客隐藏资源是否存在」的场景用它。
  async function isAdmin(openid) {
    const user = await getUser(openid);
    return !!(user && user.enabled && user.role === 'admin');
  }

  async function requireAdmin(openid) {
    const user = await getUser(openid);
    if (!user.enabled || user.role !== 'admin') {
      throw new AppError('FORBIDDEN', '当前账号没有管理员权限');
    }
    return user;
  }

  // 初始化令牌是唯一的提权入口：比较用定长算法，失败次数单独限流（见 rate-limit）。
  async function claimAdmin(openid, event) {
    const configuredToken = String(process.env.ADMIN_SETUP_TOKEN || '');
    assert(configuredToken, '尚未配置 ADMIN_SETUP_TOKEN 环境变量');
    assert(safeEqual(event.token, configuredToken), '初始化令牌不正确', 'FORBIDDEN');
    const current = await getUser(openid);
    if (current.role !== 'admin') {
      // 事务里无法自动重试，先确保集合存在。
      await store.ensureCollection(collections.users);
      // 事务保证不会并发认领出第二个管理员。
      await db.runTransaction(async (transaction) => {
        const result = await transaction.collection(collections.users)
          .where({ role: 'admin', enabled: true })
          .count();
        assert(result.total === 0, '管理员已经初始化，请联系现有管理员添加权限', 'FORBIDDEN');
        await transaction.collection(collections.users).doc(openid).update({
          data: { role: 'admin', updateTime: db.serverDate() }
        });
      });
      await seedDefaultData(false);
    }
    return { user: await getUser(openid), isAdmin: true };
  }

  async function adminStatus() {
    const adminCount = await store.countWhere(collections.users, { role: 'admin', enabled: true });
    return { adminInitialized: adminCount > 0 };
  }

  async function adminListUsers(openid, event) {
    await requireAdmin(openid);
    const { page, pageSize, skip } = parsePaging(event, 100);
    try {
      const [list, total] = await Promise.all([
        db.collection(collections.users)
          .field(USER_LIST_FIELDS)
          .orderBy('lastLoginAt', 'desc')
          .skip(skip)
          .limit(pageSize)
          .get()
          .then((result) => result.data || []),
        store.countWhere(collections.users, {})
      ]);
      return {
        list: list.map((item) => Object.assign({}, item, { openidMask: maskIdentifier(item._id) })),
        total,
        page,
        pageSize,
        hasMore: skip + list.length < total
      };
    } catch (error) {
      if (isMissingCollection(error)) return { list: [], total: 0, page, pageSize, hasMore: false };
      // 缺索引时退化为不带排序。
      console.warn('[api] 用户列表排序查询失败，退化为无序查询', error && (error.errMsg || error.message));
      const list = await db.collection(collections.users)
        .field(USER_LIST_FIELDS)
        .limit(pageSize)
        .get()
        .then((result) => result.data || []);
      return {
        list: list.map((item) => Object.assign({}, item, { openidMask: maskIdentifier(item._id) })),
        total: list.length,
        page,
        pageSize,
        hasMore: false
      };
    }
  }

  async function updateUserRole(openid, event) {
    await requireAdmin(openid);
    const userId = cleanText(event.userId, 128);
    const role = event.role === 'admin' ? 'admin' : (event.role === 'customer' ? 'customer' : '');
    assert(userId, '缺少用户标识');
    assert(role, '无效角色');
    // 禁止管理员修改自己的角色，避免误把自己降级后失去管理权限。
    assert(userId !== openid, '不能修改自己的角色', 'FORBIDDEN');
    const target = await store.getById(collections.users, userId);
    assert(target, '用户不存在', 'NOT_FOUND');
    if (target.role === 'admin' && role === 'customer') {
      const count = await store.countWhere(collections.users, { role: 'admin', enabled: true });
      assert(count > 1, '至少需要保留一名管理员');
    }
    await store.writeCollection(collections.users, (col) => col.doc(userId).update({
      data: { role, roleUpdatedBy: openid, updateTime: db.serverDate() }
    }));
    return { user: Object.assign({}, target, { role }) };
  }

  return { getUser, updateUserProfile, isAdmin, requireAdmin, claimAdmin, adminStatus, adminListUsers, updateUserRole };
}

module.exports = { createUserService };
