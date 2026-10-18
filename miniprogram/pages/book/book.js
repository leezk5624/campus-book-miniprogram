const api = require('../../utils/api');
const format = require('../../utils/format');
const image = require('../../utils/image');

function buildMetaRows(book, categoryName) {
  return [
    { label: '作者', value: book.author },
    { label: '出版社', value: book.publisher },
    { label: '出版年份', value: book.publishYear ? book.publishYear + ' 年' : '' },
    { label: 'ISBN', value: book.isbn },
    { label: '页数', value: book.pages ? book.pages + ' 页' : '' },
    { label: '分类', value: categoryName },
    { label: '馆藏位置', value: book.location }
  ].filter((item) => item.value);
}

Page({
  data: {
    loading: true,
    book: null,
    metaRows: [],
    paragraphs: [],
    tagList: []
  },

  onLoad(options) {
    this.bookId = options.id || '';
    this.loadBook();
  },

  async loadBook() {
    if (!this.bookId) {
      this.setData({ loading: false });
      return;
    }
    try {
      const detail = await api.unwrap('getBook', { bookId: this.bookId });
      const book = Object.assign({}, detail.book, {
        priceText: format.formatMoney(detail.book.price),
        originalPriceText: format.formatMoney(detail.book.originalPrice),
        stockText: Number(detail.book.stock) < 0 ? '馆藏充足' : '在馆 ' + (Number(detail.book.stock) || 0) + ' 册',
        metaText: [detail.book.author, detail.book.publisher].filter(Boolean).join(' · ')
      });
      const intro = String(book.intro || book.description || '').trim();
      const paragraphs = intro ? intro.split(/\n+/).map((item) => item.trim()).filter(Boolean) : [];
      const tagList = Array.isArray(book.tags) ? book.tags : [];

      this.setData({
        loading: false,
        book,
        metaRows: buildMetaRows(book, detail.categoryName),
        paragraphs,
        tagList
      });
      wx.setNavigationBarTitle({ title: book.name });
    } catch (error) {
      this.setData({ loading: false });
      api.toastError(error);
    }
  },

  onCoverError() {
    this.setData({ 'book.image': '' });
  },

  previewCover() {
    if (this.data.book && this.data.book.image) image.previewCover(this.data.book.image);
  }
});
