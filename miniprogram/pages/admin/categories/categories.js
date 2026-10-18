const api = require('../../../utils/api');
const auth = require('../../../utils/auth');

Page({
  data: {
    loading: true,
    categories: [],
    newName: '',
    newSort: '',
    savingNew: false
  },

  async onShow() {
    if (!(await auth.ensureAdmin())) return;
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      // 只取 1 条图书，分类计数由服务端聚合返回，避免整表拉取。
      const result = await api.unwrap('getMenu', { includeDisabled: true, pageSize: 1 });
      const counts = result.categoryCounts || {};
      const categories = (result.categories || []).filter((item) => !item.deleted).map((item) => Object.assign({}, item, {
        bookCount: counts[item._id] || 0
      }));
      this.setData({ loading: false, categories });
    } catch (error) {
      this.setData({ loading: false });
      api.showError(error);
    }
  },

  onNewInput(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.detail.value });
  },

  async addCategory() {
    if (this.data.savingNew) return;
    if (!String(this.data.newName || '').trim()) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' });
      return;
    }
    this.setData({ savingNew: true });
    try {
      await api.unwrap('saveCategory', {
        category: {
          name: this.data.newName,
          sort: Number(this.data.newSort) || this.data.categories.length + 1,
          enabled: true
        }
      });
      this.setData({ newName: '', newSort: '' });
      wx.showToast({ title: '分类已添加', icon: 'success' });
      this.loadData();
    } catch (error) {
      api.showError(error);
    } finally {
      this.setData({ savingNew: false });
    }
  },

  onCategoryInput(event) {
    const index = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    this.setData({ ['categories[' + index + '].' + field]: event.detail.value });
  },

  onEnabledChange(event) {
    this.setData({ ['categories[' + Number(event.currentTarget.dataset.index) + '].enabled']: event.detail.value });
  },

  async saveCategory(event) {
    const index = Number(event.currentTarget.dataset.index);
    const category = this.data.categories[index];
    if (!String(category.name || '').trim()) {
      wx.showToast({ title: '分类名称不能为空', icon: 'none' });
      return;
    }
    try {
      await api.unwrap('saveCategory', {
        category: Object.assign({}, category, { sort: Number(category.sort) || 0 })
      });
      wx.showToast({ title: '已保存', icon: 'success' });
      this.loadData();
    } catch (error) {
      api.showError(error);
    }
  },

  deleteCategory(event) {
    const id = event.currentTarget.dataset.id;
    const category = this.data.categories.find((item) => item._id === id);
    if (category && category.bookCount > 0) {
      wx.showToast({ title: '请先移动或删除分类下图书', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '删除分类',
      content: '确认删除“' + (category ? category.name : '') + '”？',
      confirmColor: '#d94a33',
      success: async (result) => {
        if (!result.confirm) return;
        try {
          await api.unwrap('deleteCategory', { categoryId: id });
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadData();
        } catch (error) {
          api.showError(error);
        }
      }
    });
  }
});
