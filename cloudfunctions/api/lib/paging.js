'use strict';

const { toInteger } = require('./validate');
const { MAX_PAGE_SIZE } = require('./constants');

// 页大小有上限，页码从 1 开始。
function parsePaging(event, defaultSize) {
  const source = event || {};
  const pageSize = toInteger(source.pageSize, defaultSize || 20, 1, MAX_PAGE_SIZE);
  const page = toInteger(source.page, 1, 1, 10000);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

module.exports = { parsePaging };
