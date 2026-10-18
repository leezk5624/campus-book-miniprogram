// 图书封面：选择 → 压缩 → 上传（云存储 / 本地演示）。对页面只暴露路径字符串。
const env = require('../config/env');

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const COMPRESS_THRESHOLD = 300 * 1024;

function appGlobal() {
  try {
    const app = getApp();
    return (app && app.globalData) || {};
  } catch (error) {
    return {};
  }
}

function cloudReady() {
  return !!(typeof wx !== 'undefined' && wx.cloud && appGlobal().cloudEnabled);
}

function isCloudFile(path) {
  return /^cloud:\/\//.test(String(path || ''));
}

function isLocalSavedFile(path) {
  return /^(wxfile|http):\/\/usr\//.test(String(path || ''));
}

function promisify(fn, options) {
  return new Promise((resolve, reject) => {
    fn(Object.assign({}, options, {
      success: resolve,
      fail: reject
    }));
  });
}

async function chooseImage() {
  let result;
  if (wx.chooseMedia) {
    result = await promisify(wx.chooseMedia, {
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed']
    });
  } else {
    result = await promisify(wx.chooseImage, {
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera']
    });
  }
  const files = result.tempFiles || [];
  const file = files[0];
  const tempFilePath = (file && (file.tempFilePath || file.path)) || (result.tempFilePaths && result.tempFilePaths[0]);
  if (!tempFilePath) throw new Error('未能读取所选图片');
  const size = Number((file && file.size) || 0);
  if (size > MAX_UPLOAD_SIZE) throw new Error('图片不能超过 10MB，请重新选择');
  return { tempFilePath, size };
}

// 压缩为非必需步骤：部分基础库/机型不支持时直接使用原图。
async function compressImage(tempFilePath, size) {
  if (!wx.compressImage) return tempFilePath;
  if (size && size <= COMPRESS_THRESHOLD) return tempFilePath;
  try {
    const result = await promisify(wx.compressImage, { src: tempFilePath, quality: 72 });
    return result.tempFilePath || tempFilePath;
  } catch (error) {
    return tempFilePath;
  }
}

function extensionOf(path) {
  const match = /\.([a-zA-Z0-9]+)(\?|$)/.exec(String(path || ''));
  const ext = match ? match[1].toLowerCase() : 'jpg';
  return ['jpg', 'jpeg', 'png', 'webp'].indexOf(ext) >= 0 ? ext : 'jpg';
}

function buildCloudPath(tempFilePath) {
  const date = new Date();
  const month = date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).slice(2, 8);
  return 'book-covers/' + month + '/' + Date.now() + '-' + random + '.' + extensionOf(tempFilePath);
}

function saveLocalFile(tempFilePath) {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager && wx.getFileSystemManager();
    if (!fs || typeof fs.saveFile !== 'function') {
      resolve(tempFilePath);
      return;
    }
    fs.saveFile({
      tempFilePath,
      success: (result) => resolve(result.savedFilePath || tempFilePath),
      fail: () => resolve(tempFilePath)
    });
  });
}

async function uploadCover(tempFilePath, options) {
  const filePath = String(tempFilePath || '');
  if (!filePath) throw new Error('缺少图片路径');
  const compressed = await compressImage(filePath, options && options.size);

  if (env.dataMode === 'mock') return saveLocalFile(compressed);
  if (!cloudReady()) throw new Error('云开发未就绪，暂时无法上传封面');

  const result = await promisify(wx.cloud.uploadFile.bind(wx.cloud), {
    cloudPath: buildCloudPath(compressed),
    filePath: compressed
  });
  if (!result.fileID) throw new Error('封面上传失败，请重试');
  return result.fileID;
}

async function removeCover(path) {
  const value = String(path || '');
  if (!value) return;
  if (isCloudFile(value)) {
    if (!cloudReady()) return;
    try {
      await promisify(wx.cloud.deleteFile.bind(wx.cloud), { fileList: [value] });
    } catch (error) {
      // 文件可能已不存在，忽略即可。
    }
    return;
  }
  if (isLocalSavedFile(value) && wx.getFileSystemManager) {
    try {
      await new Promise((resolve) => {
        wx.getFileSystemManager().removeSavedFile({ filePath: value, complete: resolve });
      });
    } catch (error) {
      // 忽略本地文件删除失败。
    }
  }
}

// previewImage 不接受 cloud:// 文件 ID，需要先换取临时链接。
async function toPreviewUrls(paths) {
  const list = (paths || []).filter(Boolean);
  if (!list.length) return [];
  if (!cloudReady() || !list.some(isCloudFile)) return list;
  try {
    const result = await promisify(wx.cloud.getTempFileURL.bind(wx.cloud), { fileList: list });
    const map = {};
    (result.fileList || []).forEach((item) => {
      if (item.fileID && item.tempFileURL) map[item.fileID] = item.tempFileURL;
    });
    return list.map((item) => map[item] || item);
  } catch (error) {
    return list;
  }
}

// 复制成新文件，避免两本书共用同一个云文件。
async function duplicateCover(fileID) {
  const value = String(fileID || '');
  if (!isCloudFile(value) || !cloudReady()) return value;
  try {
    const downloaded = await promisify(wx.cloud.downloadFile.bind(wx.cloud), { fileID: value });
    return await uploadCover(downloaded.tempFilePath);
  } catch (error) {
    return value;
  }
}

async function previewCover(path) {
  if (!path) return;
  const urls = await toPreviewUrls([path]);
  if (!urls.length) return;
  wx.previewImage({ urls, current: urls[0] });
}

module.exports = {
  chooseImage,
  uploadCover,
  duplicateCover,
  removeCover,
  previewCover,
  toPreviewUrls,
  isCloudFile,
  cloudReady
};
