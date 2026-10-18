const api = require('../../../utils/api');
const auth = require('../../../utils/auth');
const format = require('../../../utils/format');
const textView = require('../../../utils/text-view');

// 把服务端逐级统计渲染成“漏斗”，一眼看出图书卡在哪一道过滤上。
function buildVisibilityRows(visibility) {
  if (!visibility) return [];
  return [
    { key: 'total', label: '集合内文档总数', value: visibility.total },
    { key: 'notDeleted', label: '未删除', value: visibility.notDeleted },
    { key: 'enabled', label: '已上架', value: visibility.enabled },
    { key: 'category', label: '所属分类已启用', value: visibility.inEnabledCategory },
    { key: 'front', label: '前台实际查询返回', value: visibility.front }
  ];
}

Page({
  data: {
    loading: true,
    health: null,
    checks: [],
    collections: [],
    visibility: null,
    visibilityRows: [],
    auditLogs: []
  },

  async onShow() {
    if (!(await auth.ensureAdmin())) return;
    this.loadHealth();
  },

  onPullDownRefresh() {
    this.loadHealth(true).finally(() => wx.stopPullDownRefresh());
  },

  async loadHealth(silent) {
    if (!silent) this.setData({ loading: true });
    try {
      const health = await api.unwrap('systemHealth', {});
      health.checkedAtText = format.formatDate(health.checkedAt, true);
      const labels = { users: '用户', categories: '分类', books: '图书', settings: '设置' };
      const collections = Object.keys(health.collections || {}).map((key) => Object.assign({ key, label: labels[key] || key }, health.collections[key]));
      this.setData({
        loading: false,
        health,
        checks: health.checks || [],
        collections,
        visibility: health.visibility || null,
        visibilityRows: buildVisibilityRows(health.visibility),
        auditLogs: (health.auditLogs || []).map((item) => Object.assign({}, item, {
          timeText: format.formatDate(item.createTime, true)
        }))
      });
    } catch (error) {
      this.setData({ loading: false });
      api.toastError(error);
    }
  },

  showChecklist() {
    const lines = [
      '校园图书管理系统部署清单',
      '1. 替换真实小程序 AppID',
      '2. 开通云开发并填写 miniprogram/config/env.js 的 cloudEnv',
      '3. 创建 users/categories/books/settings 集合',
      '4. 上传并部署 cloudfunctions/api，选择云端安装依赖',
      '5. 配置 ADMIN_SETUP_TOKEN，并重新部署云函数',
      '6. 将数据库权限设置为所有用户不可读写',
      '7. 创建文档中的数据库索引（分类、排序、更新时间）',
      '8. 云存储权限设为所有用户可读，后台才可上传并展示封面',
      '9. 进入管理员设置绑定首位管理员',
      '10. 配置图书馆信息、分类和图书后自测',
      '11. 在部署与系统状态页确认全部检查通过',
      '12. 上传体验版、提交审核并发布'
    ];
    textView.showText('部署清单', lines.join('\n'));
  },

  goSetup() {
    wx.navigateTo({ url: '/pages/admin/setup/setup' });
  }
});
