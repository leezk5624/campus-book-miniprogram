'use strict';

const { assert } = require('./errors');
const { cleanText } = require('./validate');
const { DEFAULT_SETTINGS } = require('./constants');

function createSettingsService(options) {
  const db = options.db;
  const store = options.store;
  const collections = options.collections;

  // 配置只有一条（_id = library），不存在时按默认值落一份。
  async function ensureSettings() {
    const existing = await store.getById(collections.settings, 'library');
    if (existing) return existing;
    const data = Object.assign({}, DEFAULT_SETTINGS, {
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    });
    await store.writeCollection(collections.settings, (col) => col.doc('library').set({ data }));
    return Object.assign({ _id: 'library' }, data);
  }

  async function updateSettings(openid, event) {
    await options.requireAdmin(openid);
    await ensureSettings();
    const input = (event && event.settings) || {};
    const data = {
      libraryName: cleanText(input.libraryName, 30),
      notice: cleanText(input.notice, 200),
      address: cleanText(input.address, 100),
      phone: cleanText(input.phone, 20),
      openHours: cleanText(input.openHours, 30),
      updateTime: db.serverDate()
    };
    assert(data.libraryName, '请填写图书馆名称');
    await store.writeCollection(collections.settings, (col) => col.doc('library').update({ data }));
    return Object.assign({ _id: 'library' }, data);
  }

  return { ensureSettings, updateSettings };
}

module.exports = { createSettingsService };
