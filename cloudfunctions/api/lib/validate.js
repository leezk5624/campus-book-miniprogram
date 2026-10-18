'use strict';

// 入参清洗、脱敏、定长比较。都是纯函数，不依赖数据库。

const { COVER_DIRECTORY } = require('./constants');

// 按 Unicode 字符截断，避免把 emoji 的代理对截成乱码。
// 同时剔除控制字符，防止把不可见字符写进数据库再渲染到页面上。
function cleanText(value, maxLength) {
  const text = String(value === null || value === undefined ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();
  const limit = maxLength || 200;
  const chars = Array.from(text);
  return chars.length > limit ? chars.slice(0, limit).join('') : text;
}

function toMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

// 空值和非数字返回 fallback，结果限制在 [min, max] 内。
function toInteger(value, fallback, min, max) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 脱敏展示：用户标识属于个人信息，列表类接口只返回掩码。
function maskIdentifier(id) {
  const text = String(id || '');
  if (text.length <= 8) return text ? text.slice(0, 2) + '****' : '';
  return text.slice(0, 5) + '****' + text.slice(-4);
}

// 定长比较：不因第一位不同就提前返回，避免通过响应耗时逐字符猜出初始化令牌。
function safeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  const length = Math.max(left.length, right.length);
  let diff = left.length === right.length ? 0 : 1;
  for (let i = 0; i < length; i += 1) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function normalizeTags(input) {
  const raw = Array.isArray(input) ? input : String(input || '').split(/[,，、;；\s]+/);
  const seen = {};
  const tags = [];
  raw.forEach((item) => {
    const tag = cleanText(item, 12);
    if (!tag || seen[tag]) return;
    seen[tag] = true;
    if (tags.length < 8) tags.push(tag);
  });
  return tags;
}

// 封面地址校验。fileID 由客户端回传，必须落在 book-covers/ 下，
// 否则管理员能把任意云存储路径写进书目，删书时还会连带删掉那个文件。
// 空值和 http(s) 外链放行（历史数据里有）。
function isSafeCover(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  if (/^https?:\/\//i.test(text)) return text.length <= 500;
  if (text.indexOf('cloud://') !== 0) return false;
  const body = text.slice('cloud://'.length);
  const slash = body.indexOf('/');
  if (slash === -1) return false;
  const path = body.slice(slash + 1);
  if (path.indexOf('..') !== -1) return false;
  return path.indexOf(COVER_DIRECTORY) === 0 && path.length <= 300;
}

module.exports = {
  cleanText,
  toMoney,
  toInteger,
  escapeRegExp,
  maskIdentifier,
  safeEqual,
  normalizeTags,
  isSafeCover
};
