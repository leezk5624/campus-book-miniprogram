const test = require('node:test');
const assert = require('node:assert/strict');
const format = require('../../miniprogram/utils/format');

test('formatMoney 以分为单位换算为元', () => {
  assert.equal(format.formatMoney(1990), '19.90');
  assert.equal(format.formatMoney(0), '0.00');
  assert.equal(format.formatMoney(100), '1.00');
});

test('formatMoney 对非法输入退化为 0', () => {
  assert.equal(format.formatMoney(null), '0.00');
  assert.equal(format.formatMoney(undefined), '0.00');
  assert.equal(format.formatMoney('abc'), '0.00');
});

test('formatDate 输出 年-月-日 时:分', () => {
  const value = format.formatDate(new Date(2026, 9, 18, 9, 5));
  assert.equal(value, '2026-10-18 09:05');
});

test('formatDate 支持秒级输出与字符串输入', () => {
  const value = format.formatDate('2026-10-18T09:05:06', true);
  assert.equal(value.endsWith(':06'), true);
});

test('formatDate 对空值与非法日期返回占位符', () => {
  assert.equal(format.formatDate(''), '-');
  assert.equal(format.formatDate(null), '-');
  assert.equal(format.formatDate('not-a-date'), '-');
});

test('formatShortDate 输出 月日', () => {
  assert.equal(format.formatShortDate(new Date(2026, 9, 18)), '10月18日');
  assert.equal(format.formatShortDate(''), '-');
});
