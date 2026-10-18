const env = require('./config/env');

App({
  globalData: {
    cloudEnabled: false,
    cloudError: '',
    user: null,
    settings: null,
    envId: env.cloudEnv,
    version: env.version,
    projectTag: env.projectTag || '',
    icpNumber: env.icpNumber || '',
    // 后台改过数据后置为 true，首页回到前台时据此重新拉取列表。
    dataDirty: false
  },

  onLaunch() {
    this.initCloud();
  },

  markDataDirty() {
    this.globalData.dataDirty = true;
  },

  consumeDataDirty() {
    const dirty = !!this.globalData.dataDirty;
    this.globalData.dataDirty = false;
    return dirty;
  },

  initCloud() {
    if (env.dataMode === 'mock') {
      this.globalData.cloudEnabled = false;
      this.globalData.cloudError = '';
      console.info('[校园图书管理系统] 当前为本地演示模式（dataMode = mock）。');
      return;
    }

    if (!wx.cloud) {
      this.globalData.cloudEnabled = false;
      this.globalData.cloudError = '当前微信版本不支持云开发，请升级微信后重试';
      console.error('[校园图书管理系统] ' + this.globalData.cloudError);
      return;
    }

    // cloudEnv 留空时不传 env，SDK 会自动使用云开发控制台里设置的「默认环境」。
    const options = { traceUser: true };
    if (env.cloudEnv) options.env = env.cloudEnv;

    try {
      wx.cloud.init(options);
      this.globalData.cloudEnabled = true;
      this.globalData.cloudError = '';
      console.info('[校园图书管理系统] 云开发已就绪' + (env.cloudEnv ? '（环境 ' + env.cloudEnv + '）' : '（使用默认环境）'));
    } catch (error) {
      this.globalData.cloudEnabled = false;
      this.globalData.cloudError = '云开发初始化失败：' + ((error && (error.errMsg || error.message)) || '未知错误');
      console.error('[校园图书管理系统] ' + this.globalData.cloudError, error);
    }
  }
});
