const api = require('../../../utils/api');
const auth = require('../../../utils/auth');

Page({
  data: {
    loading: true,
    saving: false,
    form: {}
  },

  async onLoad() {
    if (!(await auth.ensureAdmin())) return;
    this.loadSettings();
  },

  async loadSettings() {
    try {
      const result = await api.unwrap('getSettings', {});
      const form = Object.assign({}, result.settings || {});
      this.setData({ loading: false, form });
    } catch (error) {
      this.setData({ loading: false });
      api.showError(error);
    }
  },

  onInput(event) {
    this.setData({ ['form.' + event.currentTarget.dataset.field]: event.detail.value });
  },

  resetDemoData() {
    wx.showModal({
      title: '重置示例图书',
      content: '将清空现有图书和分类，并写入 8 本示例图书，是否继续？',
      confirmColor: '#d94a33',
      success: async (result) => {
        if (!result.confirm) return;
        try {
          wx.showLoading({ title: '重置中...' });
          const res = await api.unwrap('resetDemoData', {});
          wx.hideLoading();
          wx.showToast({ title: '已写入 ' + (res.books || 0) + ' 本图书', icon: 'success' });
        } catch (error) {
          wx.hideLoading();
          api.showError(error);
        }
      }
    });
  },

  async save() {
    if (this.data.saving) return;
    const form = this.data.form;
    if (!String(form.libraryName || '').trim()) {
      wx.showToast({ title: '请填写图书馆名称', icon: 'none' });
      return;
    }
    const settings = Object.assign({}, form);
    this.setData({ saving: true });
    try {
      await api.unwrap('updateSettings', { settings });
      getApp().globalData.settings = settings;
      wx.showToast({ title: '设置已保存', icon: 'success' });
      this.loadSettings();
    } catch (error) {
      api.showError(error);
    } finally {
      this.setData({ saving: false });
    }
  }
});
