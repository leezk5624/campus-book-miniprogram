function showText(title, content) {
  wx.showModal({
    title: title || '内容',
    content: String(content || ''),
    showCancel: false,
    confirmText: '知道了'
  });
}

module.exports = { showText };
