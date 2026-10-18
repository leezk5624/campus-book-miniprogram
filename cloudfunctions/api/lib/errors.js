'use strict';

// 统一错误类型。业务异常的 message 会返回给前端，其余只返回通用文案。

class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function assert(condition, message, code) {
  if (!condition) throw new AppError(code || 'INVALID_PARAM', message);
}

// 云开发不会自动建集合，向不存在的集合读写都会报这一类错误。
function isMissingCollection(error) {
  const message = String((error && (error.errMsg || error.message)) || '');
  return /collection.*not exist|DATABASE_COLLECTION_NOT_EXIST|-502005/i.test(message);
}

// 文档不存在。必须先排除集合级错误，否则整张表没建会被当成数据为空。
function isMissingDocument(error) {
  if (isMissingCollection(error)) return false;
  const message = String((error && (error.errMsg || error.message)) || '');
  return /document.*(not exist|not found|不存在)|DOCUMENT_NOT_EXIST|document\.get:fail/i.test(message);
}

module.exports = { AppError, assert, isMissingCollection, isMissingDocument };
