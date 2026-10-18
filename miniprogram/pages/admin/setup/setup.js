const api = require('../../../utils/api');
const auth = require('../../../utils/auth');
const mock = require('../../../utils/mock');

Page({
  data: {
    token: '',
    submitting: false,
    isAdmin: false,
    demo: false,
    demoToken: mock.SETUP_TOKEN
  },

  onShow() {
    this.checkRole();
  },

  async checkRole() {
    try {
      const result = await api.unwrap('login', {});
      this.setData({
        isAdmin: !!(result.isAdmin || (result.user && result.user.role === 'admin')),
        demo: !!result.demo
      });
    } catch (error) {
      api.toastError(error);
    }
  },

  onTokenInput(event) {
    this.setData({ token: event.detail.value });
  },

  async claimAdmin() {
    if (this.data.submitting) return;
    if (!String(this.data.token || '').trim()) {
      wx.showToast({ title: '请输入初始化令牌', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await api.unwrap('claimAdmin', { token: this.data.token });
      auth.clearCache();
      wx.showToast({ title: '管理员绑定成功', icon: 'success' });
      this.setData({ isAdmin: true, token: '' });
      setTimeout(() => wx.navigateBack(), 700);
    } catch (error) {
      api.toastError(error);
    } finally {
      this.setData({ submitting: false });
    }
  }
});
