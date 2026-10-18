'use strict';

// 写操作限流，只在单个云函数实例内生效，按「用户 + 操作」分别计数。
// 实例回收后计数清零，对外防护仍要靠网关层配额。

const { AppError } = require('./errors');

function createRateLimiter(options) {
  const windowMs = options.windowMs;
  const max = options.max;
  const sensitive = options.sensitive || {};
  const actions = options.actions;
  const buckets = new Map();

  function hit(openid, action) {
    if (!actions.has(action)) return;
    const limit = sensitive[action] || max;
    const key = openid + ':' + action;
    const now = Date.now();
    // 防止长期运行的实例里桶无限增长。
    if (buckets.size > 2000) buckets.clear();
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      throw new AppError('RATE_LIMITED', '操作过于频繁，请稍后再试');
    }
  }

  function reset() {
    buckets.clear();
  }

  return { hit, reset };
}

module.exports = { createRateLimiter };
