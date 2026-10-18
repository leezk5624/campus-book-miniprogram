const api = require('../../utils/api');
const env = require('../../config/env');
const mock = require('../../utils/mock');

// 正式版优先显示微信的线上版本号；开发版/体验版回退到 env.js 里配置的版本号。
function resolveVersion() {
  try {
    const info = wx.getAccountInfoSync && wx.getAccountInfoSync();
    const version = info && info.miniProgram && info.miniProgram.version;
    if (version) return version;
  } catch (error) {
    // 忽略，回退到配置版本号
  }
  return env.version;
}

Page({
  data: {
    loading: true,
    user: null,
    isAdmin: false,
    adminInitialized: false,
    demo: false,
    projectTag: env.projectTag || '',
    icpNumber: env.icpNumber || '',
    settings: {},
    version: resolveVersion()
  },

  onShow() {
    this.loadProfile();
  },

  async loadProfile() {
    this.setData({ loading: true });
    try {
      const [loginResult, settingsResult, adminStatusResult] = await Promise.all([
        api.unwrap('login', {}),
        api.unwrap('getSettings', {}),
        api.unwrap('adminStatus', {}).catch(() => ({ adminInitialized: false }))
      ]);
      const app = getApp();
      app.globalData.user = loginResult.user;
      app.globalData.settings = settingsResult.settings;
      this.setData({
        loading: false,
        user: loginResult.user,
        isAdmin: !!(loginResult.isAdmin || (loginResult.user && loginResult.user.role === 'admin')),
        adminInitialized: !!adminStatusResult.adminInitialized,
        demo: !!loginResult.demo,
        settings: settingsResult.settings || {}
      });
    } catch (error) {
      this.setData({ loading: false });
      api.toastError(error);
    }
  },

  openUrl(event) {
    wx.navigateTo({ url: event.currentTarget.dataset.url });
  },

  callLibrary() {
    if (this.data.settings.phone) wx.makePhoneCall({ phoneNumber: this.data.settings.phone });
  },

  resetDemo() {
    wx.showModal({
      title: '重置演示数据',
      content: '图书和分类将恢复为初始状态，是否继续？',
      success: (result) => {
        if (!result.confirm) return;
        wx.removeStorageSync(mock.STORAGE_KEY);
        wx.showToast({ title: '已重置', icon: 'success' });
        setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 500);
      }
    });
  }
});
