'use strict';

// 管理员操作日志。库里存 openid，返回前端前换成掩码。

const { isMissingCollection } = require('./errors');
const { cleanText, maskIdentifier } = require('./validate');
const { parsePaging } = require('./paging');
const { AUDIT_LIST_FIELDS } = require('./constants');

function createAuditService(options) {
  const db = options.db;
  const store = options.store;
  const collections = options.collections;
  const requireAdmin = options.requireAdmin;

  // 先算掩码再删明文字段。
  function maskAuditLog(item) {
    const row = Object.assign({}, item, { openidMask: maskIdentifier(item.openid) });
    delete row.openid;
    return row;
  }

  function buildDetail(action, event) {
    const bookName = event.book && event.book.name ? event.book.name : '';
    const categoryName = event.category && event.category.name ? event.category.name : '';
    if (action === 'saveBook') return (event._id || (event.book && event.book._id)) ? '修改 ' + bookName : '新增 ' + bookName;
    if (action === 'deleteBook') return '删除 ' + cleanText(event.bookId, 64);
    if (action === 'setBookStatus') return (event.enabled ? '上架 ' : '下架 ') + cleanText(event.bookId, 64);
    if (action === 'saveCategory') return (event.category && event.category._id) ? '修改分类 ' + categoryName : '新增分类 ' + categoryName;
    if (action === 'deleteCategory') return '删除分类 ' + cleanText(event.categoryId, 64);
    if (action === 'updateUserRole') return cleanText(event.userId, 64) + ' → ' + cleanText(event.role, 16);
    if (action === 'updateSettings') return '更新系统配置';
    if (action === 'resetDemoData') return '重置示例数据';
    if (action === 'claimAdmin') return '绑定管理员';
    return '';
  }

  // 日志写失败不影响业务。
  async function writeAuditLog(openid, action, event) {
    try {
      await store.writeCollection(collections.auditLogs, (col) => col.add({
        data: {
          openid,
          action,
          detail: cleanText(buildDetail(action, event || {}), 120),
          createTime: db.serverDate()
        }
      }));
    } catch (error) {
      console.warn('[api] 审计日志写入失败', error && (error.errMsg || error.message));
    }
  }

  async function adminListAuditLogs(openid, event) {
    await requireAdmin(openid);
    const { page, pageSize, skip } = parsePaging(event, 20);
    const size = Math.min(pageSize, 50);
    try {
      const [list, total] = await Promise.all([
        db.collection(collections.auditLogs)
          .field(AUDIT_LIST_FIELDS)
          .orderBy('createTime', 'desc')
          .skip(skip)
          .limit(size)
          .get()
          .then((result) => result.data || []),
        store.countWhere(collections.auditLogs, {})
      ]);
      return {
        list: list.map(maskAuditLog),
        total,
        page,
        pageSize,
        hasMore: skip + list.length < total
      };
    } catch (error) {
      // 缺索引时退化为不带排序。
      if (isMissingCollection(error)) return { list: [], total: 0, page, pageSize, hasMore: false };
      console.warn('[api] 审计日志查询失败，退化为无序查询', error && (error.errMsg || error.message));
      const list = await db.collection(collections.auditLogs)
        .field(AUDIT_LIST_FIELDS)
        .limit(size)
        .get()
        .then((result) => result.data || []);
      return { list: list.map(maskAuditLog), total: list.length, page, pageSize, hasMore: false };
    }
  }

  return { writeAuditLog, adminListAuditLogs };
}

module.exports = { createAuditService };
