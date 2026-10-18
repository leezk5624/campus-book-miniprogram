const test = require('node:test');
const assert = require('node:assert/strict');

// 小程序工具层依赖全局 wx，测试中注入最小桩件。
const calls = [];
global.wx = {
  showModal(options) {
    calls.push(options);
  }
};

const text = require('../../miniprogram/utils/text-view');

test('showText 透传标题并字符串化内容', () => {
  text.showText('简介', 123);
  const last = calls[calls.length - 1];
  assert.equal(last.title, '简介');
  assert.equal(last.content, '123');
  assert.equal(last.showCancel, false);
});

test('showText 对空标题与空内容做回退', () => {
  text.showText('', null);
  const last = calls[calls.length - 1];
  assert.equal(last.title, '内容');
  assert.equal(last.content, '');
});
