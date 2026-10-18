const api = require('./api');

// 管理页每次 onShow 都校验权限，短时缓存避免连续云调用。
// 服务端对每个写操作独立鉴权，缓存只影响界面展示。
const CACHE_TTL = 60 * 1000;
let cached = null;
let inFlight = null;

function clearCache() {
  cached = null;
  inFlight = null;
}

async function isAdmin(options) {
  const force = !!(options && options.force);
  if (!force && cached && Date.now() - cached.at < CACHE_TTL) return cached.value;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const result = await api.unwrap('login', {});
      const value = !!(result.isAdmin || (result.user && result.user.role === 'admin' && result.user.enabled !== false));
      cached = { value, at: Date.now() };
      return value;
    } catch (error) {
      // 网络异常不写缓存，避免短暂故障把管理员锁在门外 60 秒。
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

let redirecting = false;

function redirectAway() {
  if (redirecting) return;
  redirecting = true;
  setTimeout(() => {
    redirecting = false;
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: '/pages/profile/profile' });
  }, 1000);
}

async function ensureAdmin() {
  const allowed = await isAdmin();
  if (!allowed) {
    wx.showToast({ title: '仅管理员可访问', icon: 'none', duration: 1800 });
    redirectAway();
  }
  return allowed;
}

module.exports = { isAdmin, ensureAdmin, clearCache };
