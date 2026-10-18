'use strict';

// lib/validate.js 与 lib/errors.js 的单元测试（都是纯函数）。

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const libDir = path.resolve(__dirname, '..', '..', 'cloudfunctions', 'api', 'lib');
const validate = require(path.join(libDir, 'validate.js'));
const errors = require(path.join(libDir, 'errors.js'));

test('cleanText 按字符截断，不会把 emoji 截成乱码', () => {
  assert.equal(validate.cleanText('📚📚📚', 2), '📚📚');
  assert.equal(validate.cleanText('  前后空格  '), '前后空格');
  assert.equal(validate.cleanText(null), '');
});

test('toInteger 空值退回默认值，超出范围限制到边界', () => {
  assert.equal(validate.toInteger('', 7, 0, 10), 7);
  assert.equal(validate.toInteger('abc', 7, 0, 10), 7);
  assert.equal(validate.toInteger('999', 0, 0, 10), 10);
  assert.equal(validate.toInteger('-5', 0, 0, 10), 0);
});

test('safeEqual 定长比较，长度不同也逐位比完', () => {
  assert.equal(validate.safeEqual('token', 'token'), true);
  assert.equal(validate.safeEqual('token', 'toke'), false);
  assert.equal(validate.safeEqual('token', 'tokez'), false);
  assert.equal(validate.safeEqual('', ''), true);
});

test('maskIdentifier 保留首尾各若干位，中间打码', () => {
  const mask = validate.maskIdentifier('openid_abcdefghijklmnop');
  assert.ok(mask.indexOf('****') !== -1);
  assert.ok(mask.indexOf('abcdefghijklmnop') === -1);
});

test('封面地址只接受 book-covers 目录、http 外链或空值', () => {
  assert.equal(validate.isSafeCover(''), true);
  assert.equal(validate.isSafeCover('https://example.com/a.png'), true);
  assert.equal(validate.isSafeCover('cloud://env.abc/book-covers/2026-10/a.png'), true);
  // 客户端直传后回传 fileID，指向别的目录说明被篡改。
  assert.equal(validate.isSafeCover('cloud://env.abc/private/a.png'), false);
  assert.equal(validate.isSafeCover('cloud://env.abc/book-covers/../private/a.png'), false);
  assert.equal(validate.isSafeCover('cloud://env.abc'), false);
  assert.equal(validate.isSafeCover('/etc/passwd'), false);
});

test('集合缺失与文档缺失不会被互相误判', () => {
  const collectionError = { errMsg: 'collection not exists' };
  const documentError = { errMsg: 'document.get:fail document with _id abc does not exist' };
  assert.equal(errors.isMissingCollection(collectionError), true);
  assert.equal(errors.isMissingDocument(collectionError), false);
  assert.equal(errors.isMissingCollection(documentError), false);
  assert.equal(errors.isMissingDocument(documentError), true);
});

test('业务异常带 code，断言失败按 INVALID_PARAM 抛出', () => {
  const error = new errors.AppError('FORBIDDEN', '没有权限');
  assert.equal(error.code, 'FORBIDDEN');
  assert.equal(error.message, '没有权限');
  assert.throws(() => errors.assert(false, '缺字段'), (thrown) => thrown.code === 'INVALID_PARAM');
});
