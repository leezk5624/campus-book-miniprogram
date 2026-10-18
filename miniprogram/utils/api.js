const env = require('../config/env');
const mock = require('./mock');

// 会改动数据的操作，成功后打标记，让列表页回到前台时能及时刷新。
const WRITE_ACTIONS = new Set([
  'saveBook', 'deleteBook', 'setBookStatus',
  'saveCategory', 'deleteCategory',
  'updateSettings', 'resetDemoData', 'claimAdmin', 'updateUserRole'
]);

function markDataDirty() {
  try {
    const app = getApp();
    if (app && app.globalData) app.globalData.dataDirty = true;
  } catch (error) {
    // 单测或非小程序环境里没有 App 实例，忽略即可。
  }
}

function mockMode() {
  return env.dataMode === 'mock';
}

function cloudEnabled() {
  const app = getApp();
  return !!(app && app.globalData && app.globalData.cloudEnabled && wx.cloud);
}

function cloudNotReady() {
  const app = getApp();
  const message = (app && app.globalData && app.globalData.cloudError)
    || '云开发未就绪，请确认小程序已开通云开发，并在云开发控制台设置了默认环境';
  return { ok: false, error: { code: 'CLOUD_NOT_READY', message } };
}

// 云调用失败大多带 “fail” 字样，笼统报成断网会误导排查，这里按类型分别提示。
function normalizeError(error) {
  const fallback = { code: 'UNKNOWN', message: '服务暂时不可用，请稍后重试' };
  if (!error) return fallback;
  const message = String(error.errMsg || error.message || '');

  if (/FunctionName|FunctionNotFound|function.*not exist|云函数.*不存在/i.test(message)) {
    return { code: 'FUNCTION_NOT_DEPLOYED', message: '云函数 api 未部署，请在开发者工具右键 cloudfunctions/api 上传并部署' };
  }
  if (/(env|environment|环境).*(not exist|not found|invalid|不存在|无效)/i.test(message)) {
    return { code: 'ENV_NOT_READY', message: '云开发环境不可用，请检查 miniprogram/config/env.js 的 cloudEnv' };
  }
  if (/permission|denied|-502003|权限/i.test(message)) {
    return { code: 'PERMISSION_DENIED', message: '数据库权限被拒绝，请在云开发控制台检查集合权限配置' };
  }
  if (/timeout|request:fail|network|网络/i.test(message)) {
    return { code: 'NETWORK', message: '网络连接失败，请检查网络后重试' };
  }
  return {
    code: error.code || 'UNKNOWN',
    message: error.message || error.errMsg || fallback.message
  };
}

async function call(action, payload) {
  const result = mockMode() ? await callMock(action, payload) : await callCloud(action, payload);
  if (result.ok && WRITE_ACTIONS.has(action)) markDataDirty();
  return result;
}

async function callMock(action, payload) {
  try {
    const data = await mock.request(action, payload || {});
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: normalizeError(error) };
  }
}

async function callCloud(action, payload) {
  if (!cloudEnabled()) return cloudNotReady();

  try {
    const response = await wx.cloud.callFunction({
      name: env.apiFunctionName,
      data: Object.assign({ action }, payload || {})
    });
    return response.result || { ok: false, error: { message: '云函数无返回内容' } };
  } catch (error) {
    return { ok: false, error: normalizeError(error) };
  }
}

async function unwrap(action, payload) {
  const result = await call(action, payload);
  if (!result.ok) {
    const error = new Error(result.error && result.error.message ? result.error.message : '操作失败');
    error.code = result.error && result.error.code;
    throw error;
  }
  return result.data;
}

function toastError(error) {
  wx.showToast({
    title: (error && error.message) || '操作失败',
    icon: 'none',
    duration: 2200
  });
}

// 排查类提示较长，showToast 会截断，后台写失败改用弹窗。
function showError(error) {
  const message = String((error && error.message) || '操作失败');
  if (Array.from(message).length > 16) {
    wx.showModal({ title: '操作失败', content: message, showCancel: false, confirmText: '知道了' });
    return;
  }
  wx.showToast({ title: message, icon: 'none', duration: 2200 });
}

module.exports = {
  call,
  unwrap,
  toastError,
  showError,
  cloudEnabled,
  mockMode
};
