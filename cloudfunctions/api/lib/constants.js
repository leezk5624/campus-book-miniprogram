'use strict';

// 全局常量。

// 集合名需与云开发控制台里的集合名一致。
const COLLECTIONS = {
  users: 'users',
  categories: 'categories',
  books: 'books',
  settings: 'settings',
  auditLogs: 'auditLogs'
};

const DEFAULT_SETTINGS = {
  libraryName: '校园图书管理系统',
  notice: '欢迎使用图书管理系统，数据均为示例',
  address: '请在管理后台填写图书馆地址',
  phone: '',
  openHours: '08:00-22:00'
};

// 列表只返回展示需要的字段，长简介由详情接口单独返回。
const LIST_FIELDS = {
  categoryId: true,
  name: true,
  author: true,
  publisher: true,
  isbn: true,
  description: true,
  price: true,
  originalPrice: true,
  stock: true,
  sales: true,
  enabled: true,
  recommended: true,
  image: true,
  emoji: true,
  sort: true,
  updateTime: true
};

const USER_LIST_FIELDS = {
  nickName: true,
  avatarUrl: true,
  role: true,
  enabled: true,
  lastLoginAt: true,
  createTime: true
};

const AUDIT_LIST_FIELDS = {
  openid: true,
  action: true,
  detail: true,
  createTime: true
};

// 单页上限，防止一次拉取过多文档。
const MAX_PAGE_SIZE = 100;

// 写操作限流的默认窗口与阈值。
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 30;

// 需要限流和记日志的操作。
const WRITE_ACTIONS = new Set([
  'saveBook', 'deleteBook', 'setBookStatus',
  'saveCategory', 'deleteCategory',
  'updateSettings', 'resetDemoData', 'claimAdmin', 'updateUserRole'
]);

// 初始化令牌是唯一的提权入口，单独收紧到 5 次/分钟，避免被枚举。
const SENSITIVE_ACTIONS = { claimAdmin: 5 };

// 分类计数缓存时长。
const CATEGORY_COUNTS_TTL = 30 * 1000;

// 封面文件目录，服务端据此校验客户端回传的 fileID。
const COVER_DIRECTORY = 'book-covers/';

module.exports = {
  COLLECTIONS,
  DEFAULT_SETTINGS,
  LIST_FIELDS,
  USER_LIST_FIELDS,
  AUDIT_LIST_FIELDS,
  MAX_PAGE_SIZE,
  RATE_WINDOW_MS,
  RATE_MAX,
  WRITE_ACTIONS,
  SENSITIVE_ACTIONS,
  CATEGORY_COUNTS_TTL,
  COVER_DIRECTORY
};
