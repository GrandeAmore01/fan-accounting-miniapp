const apiService = require('./apiService');
const storageService = require('./storageService');

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const AVATAR_UPLOAD_TIMEOUT = 15000;
const PROFILE_SAVE_TIMEOUT = 15000;
const TEMP_FILE_URL_TIMEOUT = 10000;

function withTimeout(promise, timeout, message) {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeout);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function getFileInfo(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileInfo({
      filePath,
      success: resolve,
      fail(error) {
        reject(new Error(error.errMsg || '无法读取头像文件'));
      }
    });
  });
}

function uploadFile(cloudPath, filePath, timeout = AVATAR_UPLOAD_TIMEOUT) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    let uploadTask = null;
    const timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      settled = true;
      if (uploadTask && typeof uploadTask.abort === 'function') {
        uploadTask.abort();
      }
      reject(new Error('头像上传超时，请重试'));
    }, timeout);

    uploadTask = wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success(result) {
        if (timedOut) {
          if (result.fileID) deleteFile(result.fileID);
          return;
        }
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      },
      fail(error) {
        if (timedOut || settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(error.errMsg || '头像上传失败'));
      }
    });
  });
}

function getTempFileUrl(fileId) {
  if (!fileId) return Promise.resolve('');
  return withTimeout(
    new Promise((resolve, reject) => {
      wx.cloud.getTempFileURL({
        fileList: [fileId],
        success(result) {
          const file = (result.fileList || [])[0] || {};
          if (file.status && file.status !== 0) {
            reject(new Error(file.errMsg || '头像加载失败'));
            return;
          }
          resolve(file.tempFileURL || '');
        },
        fail(error) {
          reject(new Error(error.errMsg || '头像加载失败'));
        }
      });
    }),
    TEMP_FILE_URL_TIMEOUT,
    '头像加载超时，请重试'
  );
}

function deleteFile(fileId) {
  if (!fileId) return Promise.resolve();
  return new Promise((resolve) => {
    wx.cloud.deleteFile({
      fileList: [fileId],
      success: resolve,
      fail(error) {
        console.warn('旧头像清理失败，将保留云端文件', error);
        resolve();
      }
    });
  });
}

function normalizeExtension(filePath) {
  const matched = String(filePath || '').toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/);
  const extension = matched ? matched[1] : 'jpg';
  return ['jpg', 'jpeg', 'png', 'webp'].includes(extension) ? extension : 'jpg';
}

function createCloudPath(filePath) {
  const userId = storageService.getActiveUserId().replace(/[^a-zA-Z0-9_-]/g, '') || 'user';
  const random = Math.random().toString(36).slice(2, 12);
  return `avatars/${userId}/${Date.now()}-${random}.${normalizeExtension(filePath)}`;
}

function cacheProfile(profile) {
  const userData = storageService.readUserData();
  const nextAvatarFileId = profile.avatarFileId || '';
  const avatarUrl = nextAvatarFileId && nextAvatarFileId === userData.profile.avatarFileId
    ? userData.profile.avatarUrl || ''
    : '';
  userData.profile = {
    ...userData.profile,
    nickname: profile.displayName || '微信用户',
    displayName: profile.displayName || '微信用户',
    avatarFileId: nextAvatarFileId,
    avatarUrl,
    loginStatus: true
  };
  storageService.writeUserData(null, userData);
  return userData.profile;
}

function cacheAvatarUrl(fileId, avatarUrl) {
  if (!fileId || !avatarUrl) return;
  const userData = storageService.readUserData();
  if (userData.profile.avatarFileId !== fileId) return;
  userData.profile = {
    ...userData.profile,
    avatarUrl
  };
  storageService.writeUserData(null, userData);
}

async function getProfile() {
  const profile = await apiService.request({ url: '/profile' });
  cacheProfile(profile || {});
  return profile;
}

async function saveProfile(payload) {
  const profile = await withTimeout(
    apiService.request({
      url: '/profile',
      method: 'PUT',
      data: payload
    }),
    PROFILE_SAVE_TIMEOUT,
    '暂时离线，请稍后重试'
  );
  cacheProfile(profile || {});
  return profile;
}

async function uploadAvatar(filePath) {
  const info = await getFileInfo(filePath);
  if (Number(info.size || 0) > MAX_AVATAR_SIZE) {
    throw new Error('头像图片不能超过2MB');
  }
  const result = await uploadFile(createCloudPath(filePath), filePath);
  if (!result.fileID) throw new Error('头像上传未返回文件标识');
  return result.fileID;
}

module.exports = {
  getProfile,
  saveProfile,
  uploadAvatar,
  getTempFileUrl,
  cacheAvatarUrl,
  deleteFile
};
