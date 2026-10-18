const api = require('../../utils/api');
const format = require('../../utils/format');

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE = 300;
// 回到前台时的最小重新加载间隔，避免从详情页返回就重复请求。
const REFRESH_INTERVAL = 10 * 1000;

function decorate(book) {
  return Object.assign({}, book, {
    priceText: format.formatMoney(book.price),
    originalPriceText: format.formatMoney(book.originalPrice),
    stockText: Number(book.stock) < 0 ? '馆藏充足' : '在馆 ' + (Number(book.stock) || 0) + ' 册',
    metaText: [book.author, book.publisher].filter(Boolean).join(' · ')
  });
}

Page({
  data: {
    loading: true,
    loadingMore: false,
    demo: false,
    settings: {},
    categories: [],
    categoryCounts: {},
    activeCategoryId: 'all',
    books: [],
    keyword: '',
    page: 1,
    total: 0,
    hasMore: false,
    projectTag: '',
    icpNumber: ''
  },

  onLoad() {
    const app = getApp();
    this.setData({
      projectTag: (app && app.globalData && app.globalData.projectTag) || '',
      icpNumber: (app && app.globalData && app.globalData.icpNumber) || ''
    });
    this.loadBooks({ reset: true });
  },

  onShow() {
    // 后台新增/修改过图书后必须重新拉取，否则切回首页看到的还是旧列表；
    // 没有改动时只在超过刷新间隔后才补拉，避免从详情页返回就重复请求。
    const app = getApp();
    const dirty = !!(app && app.consumeDataDirty && app.consumeDataDirty());
    if (dirty || !this.lastLoadedAt || Date.now() - this.lastLoadedAt > REFRESH_INTERVAL) {
      this.loadBooks({ reset: true });
    }
  },

  onUnload() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  },

  onPullDownRefresh() {
    this.loadBooks({ reset: true }).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore && !this.data.loading) {
      this.loadBooks({ reset: false });
    }
  },

  async loadBooks(options) {
    const reset = !options || options.reset !== false;
    if (!reset && !this.data.hasMore) return;
    // 请求序号：快速切换分类或搜索时会并发请求，用序号丢弃过期响应，避免旧结果覆盖新列表。
    const seq = (this.reqSeq || 0) + 1;
    this.reqSeq = seq;
    const page = reset ? 1 : this.data.page + 1;
    this.setData(reset ? { loading: true } : { loadingMore: true });

    try {
      const result = await api.unwrap('getMenu', {
        page,
        pageSize: PAGE_SIZE,
        keyword: String(this.data.keyword || '').trim(),
        categoryId: this.data.activeCategoryId === 'all' ? '' : this.data.activeCategoryId
      });
      if (seq !== this.reqSeq) return;

      const categories = result.categories || [];
      const previousCategoryId = this.data.activeCategoryId;
      let activeCategoryId = previousCategoryId;
      if (activeCategoryId !== 'all' && !categories.some((item) => item._id === activeCategoryId)) {
        activeCategoryId = 'all';
      }
      const books = (result.books || []).map(decorate);

      this.setData({
        loading: false,
        loadingMore: false,
        demo: !!result.demo,
        settings: result.settings || {},
        categories,
        categoryCounts: result.categoryCounts || {},
        books: reset ? books : this.data.books.concat(books),
        page: result.page || page,
        // 中途页 total 为 -1（未统计），沿用旧值；最后一页由服务端算准。
        total: Number(result.total) >= 0 ? Number(result.total) : this.data.total,
        hasMore: !!result.hasMore,
        activeCategoryId
      });

      this.lastLoadedAt = Date.now();
      if (activeCategoryId !== previousCategoryId) this.loadBooks({ reset: true });
      wx.setNavigationBarTitle({ title: (result.settings && result.settings.libraryName) || '图书管理系统' });
    } catch (error) {
      if (seq !== this.reqSeq) return;
      this.setData({ loading: false, loadingMore: false });
      api.toastError(error);
    }
  },

  onSearchInput(event) {
    this.setData({ keyword: event.detail.value });
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadBooks({ reset: true }), SEARCH_DEBOUNCE);
  },

  clearSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.setData({ keyword: '' });
    this.loadBooks({ reset: true });
  },

  chooseCategory(event) {
    const id = event.currentTarget.dataset.id;
    if (id === this.data.activeCategoryId) return;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.setData({ activeCategoryId: id }, () => this.loadBooks({ reset: true }));
  },

  onCoverError(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0) return;
    this.setData({ ['books[' + index + '].image']: '' });
  },

  goBook(event) {
    wx.navigateTo({ url: '/pages/book/book?id=' + event.currentTarget.dataset.id });
  },

  callLibrary() {
    const phone = this.data.settings.phone;
    if (phone) wx.makePhoneCall({ phoneNumber: phone });
  }
});
