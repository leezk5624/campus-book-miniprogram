const api = require('../../../utils/api');
const auth = require('../../../utils/auth');
const format = require('../../../utils/format');

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE = 300;

Page({
  data: {
    loading: true,
    loadingMore: false,
    keyword: '',
    categories: [],
    activeCategoryId: 'all',
    list: [],
    total: 0,
    page: 1,
    hasMore: false,
    categoryCounts: {}
  },

  async onShow() {
    if (!(await auth.ensureAdmin())) return;
    await this.loadCategories();
    this.fetchList({ reset: true });
  },

  onUnload() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  },

  onCoverError(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0) return;
    this.setData({ ['list[' + index + '].image']: '' });
  },

  onPullDownRefresh() {
    this.fetchList({ reset: true }).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore && !this.data.loading) {
      this.fetchList({ reset: false });
    }
  },

  async loadCategories() {
    try {
      const result = await api.unwrap('getCategories', { includeDisabled: true });
      const categories = (result.categories || []).filter((item) => !item.deleted);
      const activeCategoryId = this.data.activeCategoryId;
      if (activeCategoryId !== 'all' && !categories.some((item) => item._id === activeCategoryId)) {
        this.setData({ activeCategoryId: 'all' });
      }
      this.setData({ categories });
    } catch (error) {
      // 分类加载失败不阻塞列表。
    }
  },

  async fetchList(options) {
    const reset = !options || options.reset !== false;
    // 请求序号：快速切换分类或搜索时会并发请求，用序号丢弃过期响应，避免旧结果覆盖新列表。
    const seq = (this.reqSeq || 0) + 1;
    this.reqSeq = seq;
    const page = reset ? 1 : this.data.page + 1;
    this.setData(reset ? { loading: true } : { loadingMore: true });

    try {
      const result = await api.unwrap('listBooks', {
        page,
        pageSize: PAGE_SIZE,
        keyword: String(this.data.keyword || '').trim(),
        categoryId: this.data.activeCategoryId
      });
      if (seq !== this.reqSeq) return;

      const categoryNameMap = {};
      this.data.categories.forEach((item) => { categoryNameMap[item._id] = item.name; });
      const items = (result.list || []).map((item) => Object.assign({}, item, {
        priceText: format.formatMoney(item.price),
        stockText: Number(item.stock) < 0 ? '不限馆藏' : '在馆 ' + (Number(item.stock) || 0) + ' 册',
        categoryName: categoryNameMap[item.categoryId] || '未分类'
      }));

      const patch = {
        loading: false,
        loadingMore: false,
        list: reset ? items : this.data.list.concat(items),
        page: result.page || page,
        total: Number(result.total) || 0,
        hasMore: !!result.hasMore
      };
      if (result.categoryCounts && Object.keys(result.categoryCounts).length) {
        patch.categoryCounts = result.categoryCounts;
      }
      this.setData(patch);
    } catch (error) {
      if (seq !== this.reqSeq) return;
      this.setData({ loading: false, loadingMore: false });
      api.toastError(error);
    }
  },

  onSearchInput(event) {
    const keyword = event.detail.value;
    this.setData({ keyword });
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.fetchList({ reset: true }), SEARCH_DEBOUNCE);
  },

  clearSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.setData({ keyword: '' });
    this.fetchList({ reset: true });
  },

  chooseCategory(event) {
    const id = event.currentTarget.dataset.id;
    if (id === this.data.activeCategoryId) return;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.setData({ activeCategoryId: id }, () => this.fetchList({ reset: true }));
  },

  addBook() {
    wx.navigateTo({ url: '/pages/admin/book-edit/book-edit' });
  },

  editBook(event) {
    wx.navigateTo({ url: '/pages/admin/book-edit/book-edit?id=' + event.currentTarget.dataset.id });
  },

  copyBook(event) {
    wx.navigateTo({ url: '/pages/admin/book-edit/book-edit?copyId=' + event.currentTarget.dataset.id });
  },

  openCategories() {
    wx.navigateTo({ url: '/pages/admin/categories/categories' });
  },

  async toggleBook(event) {
    const id = event.currentTarget.dataset.id;
    const enabled = event.detail.value;
    const index = this.data.list.findIndex((item) => item._id === id);
    try {
      await api.unwrap('setBookStatus', { bookId: id, enabled });
      if (index >= 0) this.setData({ ['list[' + index + '].enabled']: enabled });
      wx.showToast({ title: enabled ? '图书已上架' : '图书已下架', icon: 'success' });
    } catch (error) {
      api.showError(error);
      if (index >= 0) this.setData({ ['list[' + index + '].enabled']: !enabled });
    }
  },

  deleteBook(event) {
    const id = event.currentTarget.dataset.id;
    const book = this.data.list.find((item) => item._id === id);
    wx.showModal({
      title: '删除图书',
      content: '确认删除“' + (book ? book.name : '') + '”？封面文件会一并删除，且无法恢复。',
      confirmColor: '#d94a33',
      success: async (result) => {
        if (!result.confirm) return;
        try {
          await api.unwrap('deleteBook', { bookId: id });
          wx.showToast({ title: '已删除', icon: 'success' });
          // 删除会改变分页偏移，重新拉取第一页避免漏项。
          this.fetchList({ reset: true });
        } catch (error) {
          api.showError(error);
        }
      }
    });
  }
});
