const api = require('../../../utils/api');
const auth = require('../../../utils/auth');
const image = require('../../../utils/image');

const INTRO_LIMIT = 2000;

function emptyBook(categoryId) {
  return {
    categoryId: categoryId || '',
    name: '',
    author: '',
    publisher: '',
    isbn: '',
    publishYear: '',
    pages: '',
    description: '',
    intro: '',
    price: '',
    originalPrice: '',
    stock: '',
    location: '',
    tagsText: '',
    sort: '0',
    enabled: true,
    recommended: false,
    image: '',
    emoji: '📘'
  };
}

function toForm(book, copyMode) {
  const source = book || {};
  const tags = Array.isArray(source.tags) ? source.tags.join('、') : String(source.tags || '');
  const name = String(source.name || '');
  return {
    categoryId: source.categoryId || '',
    name: copyMode ? (name + '（副本）').slice(0, 60) : name,
    author: source.author || '',
    publisher: source.publisher || '',
    isbn: source.isbn || '',
    publishYear: source.publishYear ? String(source.publishYear) : '',
    pages: source.pages ? String(source.pages) : '',
    description: source.description || '',
    intro: source.intro || '',
    price: (Number(source.price || 0) / 100).toFixed(2),
    originalPrice: source.originalPrice ? (Number(source.originalPrice) / 100).toFixed(2) : '',
    stock: Number(source.stock) < 0 ? '' : String(Number(source.stock) || 0),
    location: source.location || '',
    tagsText: tags,
    sort: String(Number(source.sort) || 0),
    enabled: source.enabled !== false,
    recommended: !!source.recommended,
    image: source.image || '',
    emoji: source.emoji || '📘'
  };
}

function splitTags(text) {
  const seen = {};
  const list = [];
  String(text || '').split(/[,，、;；\s]+/).forEach((item) => {
    const tag = item.trim().slice(0, 12);
    if (!tag || seen[tag]) return;
    seen[tag] = true;
    if (list.length < 8) list.push(tag);
  });
  return list;
}

Page({
  data: {
    loading: true,
    saving: false,
    uploading: false,
    isEdit: false,
    copyMode: false,
    bookId: '',
    categories: [],
    categoryNames: [],
    categoryIndex: 0,
    stockUnlimited: true,
    introLimit: INTRO_LIMIT,
    introLength: 0,
    form: emptyBook()
  },

  async onLoad(options) {
    // 本次会话新上传、尚未随表单保存的封面，离开页面时需要清理。
    this.unsavedCover = '';
    this.saved = false;
    if (!(await auth.ensureAdmin())) return;
    const sourceId = options.id || options.copyId || '';
    const copyMode = !options.id && !!options.copyId;
    this.setData({ bookId: options.id || '', isEdit: !!options.id, copyMode });
    this.loadBook(sourceId, copyMode);
  },

  onUnload() {
    if (!this.saved && this.unsavedCover) image.removeCover(this.unsavedCover);
  },

  async loadBook(id, copyMode) {
    try {
      const [categoryResult, detail] = await Promise.all([
        api.unwrap('getCategories', { includeDisabled: true }),
        id ? api.unwrap('getBook', { bookId: id }) : Promise.resolve(null)
      ]);
      const categories = (categoryResult.categories || []).filter((item) => !item.deleted);
      const form = toForm(detail && detail.book, copyMode);
      if (!form.categoryId && categories[0]) form.categoryId = categories[0]._id;
      const categoryIndex = Math.max(0, categories.findIndex((item) => item._id === form.categoryId));
      this.setData({
        loading: false,
        categories,
        categoryNames: categories.map((item) => item.name),
        categoryIndex,
        stockUnlimited: Number(detail && detail.book && detail.book.stock) < 0 || !detail,
        introLength: Array.from(form.intro || '').length,
        form
      });
      wx.setNavigationBarTitle({ title: copyMode ? '复制图书' : (id ? '编辑图书' : '新增图书') });
    } catch (error) {
      this.setData({ loading: false });
      api.toastError(error);
      setTimeout(() => wx.navigateBack(), 1200);
    }
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    const patch = {};
    patch['form.' + field] = value;
    if (field === 'intro') patch.introLength = Array.from(String(value || '')).length;
    this.setData(patch);
  },

  onCategoryChange(event) {
    const index = Number(event.detail.value);
    const category = this.data.categories[index];
    if (!category) return;
    this.setData({ categoryIndex: index, 'form.categoryId': category._id });
  },

  onSwitch(event) {
    this.setData({ ['form.' + event.currentTarget.dataset.field]: event.detail.value });
  },

  onStockUnlimited(event) {
    this.setData({ stockUnlimited: event.detail.value, 'form.stock': event.detail.value ? '' : '0' });
  },

  async chooseCover() {
    if (this.data.uploading || this.data.saving) return;
    let picked;
    try {
      picked = await image.chooseImage();
    } catch (error) {
      const message = String((error && (error.errMsg || error.message)) || '');
      if (!/cancel/i.test(message)) api.toastError({ message: message || '选择图片失败' });
      return;
    }

    this.setData({ uploading: true });
    wx.showLoading({ title: '上传封面...', mask: true });
    try {
      const fileID = await image.uploadCover(picked.tempFilePath, { size: picked.size });
      const previous = this.unsavedCover;
      if (previous && previous !== fileID) await image.removeCover(previous);
      this.unsavedCover = fileID;
      this.setData({ 'form.image': fileID });
    } catch (error) {
      api.toastError({ message: (error && (error.message || error.errMsg)) || '封面上传失败' });
    } finally {
      wx.hideLoading();
      this.setData({ uploading: false });
    }
  },

  removeCover() {
    if (this.data.uploading || this.data.saving) return;
    const current = this.data.form.image;
    if (!current) return;
    wx.showModal({
      title: '移除封面',
      content: '保存后生效，未保存前可重新上传。',
      confirmColor: '#d94a33',
      success: async (result) => {
        if (!result.confirm) return;
        if (current === this.unsavedCover) {
          await image.removeCover(current);
          this.unsavedCover = '';
        }
        this.setData({ 'form.image': '' });
      }
    });
  },

  previewCover() {
    if (this.data.form.image) image.previewCover(this.data.form.image);
  },

  async save() {
    if (this.data.saving || this.data.uploading) return;
    const form = this.data.form;
    const name = String(form.name || '').trim();
    if (!name) return void wx.showToast({ title: '请填写图书名称', icon: 'none' });
    if (!form.categoryId) return void wx.showToast({ title: '请先创建并选择分类', icon: 'none' });

    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) return void wx.showToast({ title: '请填写正确定价', icon: 'none' });
    if (price > 1000000) return void wx.showToast({ title: '定价超出允许范围', icon: 'none' });
    const originalPrice = form.originalPrice === '' ? 0 : Number(form.originalPrice);
    if (!Number.isFinite(originalPrice) || originalPrice < 0) {
      return void wx.showToast({ title: '划线价格式不正确', icon: 'none' });
    }
    if (originalPrice > 1000000) return void wx.showToast({ title: '划线价超出允许范围', icon: 'none' });
    const isbn = String(form.isbn || '').replace(/\s/g, '');
    if (isbn && !/^[0-9Xx-]{10,17}$/.test(isbn)) {
      return void wx.showToast({ title: 'ISBN 格式不正确', icon: 'none' });
    }
    const year = form.publishYear === '' ? 0 : Number(form.publishYear);
    if (!Number.isInteger(year) || year < 0 || year > new Date().getFullYear() + 1) {
      return void wx.showToast({ title: '出版年份不正确', icon: 'none' });
    }
    const pages = form.pages === '' ? 0 : Number(form.pages);
    if (!Number.isInteger(pages) || pages < 0 || pages > 100000) {
      return void wx.showToast({ title: '页数不正确', icon: 'none' });
    }

    const stock = this.data.stockUnlimited ? -1 : Math.max(0, Math.floor(Number(form.stock) || 0));
    const book = {
      categoryId: form.categoryId,
      name,
      author: form.author,
      publisher: form.publisher,
      isbn,
      publishYear: year,
      pages,
      description: form.description,
      intro: form.intro,
      price: Math.round(price * 100),
      originalPrice: Math.round(originalPrice * 100),
      stock,
      location: form.location,
      tags: splitTags(form.tagsText),
      sort: Number(form.sort) || 0,
      enabled: form.enabled !== false,
      recommended: !!form.recommended,
      image: form.image,
      emoji: form.emoji || '📘'
    };
    if (this.data.bookId) book._id = this.data.bookId;

    this.setData({ saving: true });
    try {
      // 复制图书时共用云文件会在原书换封面时被连带删除，这里先复制出独立文件。
      if (this.data.copyMode && book.image) {
        const duplicated = await image.duplicateCover(book.image);
        if (duplicated && duplicated !== book.image) {
          book.image = duplicated;
          this.unsavedCover = duplicated;
        }
      }
      await api.unwrap('saveBook', { book });
      this.saved = true;
      this.unsavedCover = '';
      wx.showToast({
        title: this.data.copyMode ? '副本已创建' : (this.data.isEdit ? '修改已保存' : '图书已添加'),
        icon: 'success'
      });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (error) {
      api.showError(error);
    } finally {
      this.setData({ saving: false });
    }
  }
});
