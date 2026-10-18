const api = require('../../../utils/api');
const auth = require('../../../utils/auth');
const format = require('../../../utils/format');
const textView = require('../../../utils/text-view');

Page({
  data: {
    loading: true,
    updatingId: '',
    meOpenid: '',
    users: [],
    adminCount: 0
  },

  async onShow() {
    if (!(await auth.ensureAdmin())) return;
    this.loadUsers();
  },

  onPullDownRefresh() {
    this.loadUsers(true).finally(() => wx.stopPullDownRefresh());
  },

  async loadUsers(silent) {
    if (!silent) this.setData({ loading: true });
    try {
      const [result, loginResult] = await Promise.all([
        api.unwrap('adminListUsers', {}),
        api.unwrap('login', {})
      ]);
      const meOpenid = (loginResult.user && loginResult.user.openid) || '';
      const users = (result.list || []).map((item) => Object.assign({}, item, {
        displayName: item.nickName || '微信用户',
        openidShort: item.openidMask || '',
        roleText: item.role === 'admin' ? '管理员' : '普通用户',
        lastLoginText: format.formatDate(item.lastLoginAt || item.createTime),
        isMe: item._id === meOpenid
      }));
      this.setData({
        loading: false,
        meOpenid,
        users,
        adminCount: users.filter((item) => item.role === 'admin' && item.enabled !== false).length
      });
    } catch (error) {
      this.setData({ loading: false });
      api.toastError(error);
    }
  },

  changeRole(event) {
    const openid = event.currentTarget.dataset.id;
    const user = this.data.users.find((item) => item._id === openid);
    if (!user || this.data.updatingId) return;
    const nextRole = user.role === 'admin' ? 'customer' : 'admin';
    const actionText = nextRole === 'admin' ? '授予管理员权限' : '取消管理员权限';
    if (nextRole === 'customer' && this.data.adminCount <= 1) {
      wx.showToast({ title: '至少需要保留一名管理员', icon: 'none' });
      return;
    }
    wx.showModal({
      title: actionText,
      content: '确认对“' + user.displayName + '”执行此操作吗？',
      confirmColor: nextRole === 'admin' ? '#19895f' : '#d94a33',
      success: async (result) => {
        if (!result.confirm) return;
        this.setData({ updatingId: openid });
        try {
          await api.unwrap('updateUserRole', { userId: openid, role: nextRole });
          wx.showToast({ title: '权限已更新', icon: 'success' });
          this.loadUsers(true);
        } catch (error) {
          api.toastError(error);
        } finally {
          this.setData({ updatingId: '' });
        }
      }
    });
  },

  showGuide() {
    const text = [
      '成员管理员添加方法：',
      '1. 成员先打开小程序并进入“我的”页面，让系统创建账号。',
      '2. 现有管理员进入“成员与权限”。',
      '3. 找到成员微信账号，点击“设为管理员”。',
      '4. 成员重新进入小程序后即可看到管理功能。',
      '5. 成员离职后，及时取消管理员权限。'
    ].join('\n');
    textView.showText('操作说明', text);
  }
});
