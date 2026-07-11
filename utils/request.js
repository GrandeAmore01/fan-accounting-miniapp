const { CLOUD_ENV_ID } = require('../services/config');

const CLOUD_SERVICE_NAME = 'fan-accounting-api';
const TOKEN_STORAGE_KEY = 'fan_accounting_auth_token';
let loginPromise = null;

function callContainer(options, token = '') {
  return new Promise((resolve, reject) => {
    wx.cloud.callContainer({
      config: { env: CLOUD_ENV_ID },
      path: options.path,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'content-type': 'application/json',
        'X-WX-SERVICE': CLOUD_SERVICE_NAME,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.header || {})
      },
      success: resolve,
      fail(error) {
        reject(new Error(error.errMsg || '网络请求失败'));
      }
    });
  });
}

function getLoginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(result) {
        if (result.code) {
          resolve(result.code);
          return;
        }
        reject(new Error('微信登录未返回 code'));
      },
      fail(error) {
        reject(new Error(error.errMsg || '微信登录失败'));
      }
    });
  });
}

async function login() {
  if (loginPromise) {
    return loginPromise;
  }
  loginPromise = (async () => {
    const code = await getLoginCode();
    const response = await callContainer({
      path: '/api/auth/login',
      method: 'POST',
      data: { code }
    });
    const body = response.data || {};
    if (response.statusCode < 200 || response.statusCode >= 300 || body.ok === false || !body.data?.token) {
      throw new Error(body.message || `登录失败：${response.statusCode}`);
    }
    wx.setStorageSync(TOKEN_STORAGE_KEY, body.data.token);
    require('../services/storageService').setActiveUser(body.data.userId);
    return body.data.token;
  })().finally(() => {
    loginPromise = null;
  });
  return loginPromise;
}

async function request(options) {
  let token = wx.getStorageSync(TOKEN_STORAGE_KEY) || '';
  if (!token) {
    token = await login();
  }

  let response = await callContainer(options, token);
  if (response.statusCode === 401) {
    wx.removeStorageSync(TOKEN_STORAGE_KEY);
    token = await login();
    response = await callContainer(options, token);
  }

  const body = response.data || {};
  if (response.statusCode >= 200 && response.statusCode < 300 && body.ok !== false) {
    return body.data;
  }
  throw new Error(body.message || `请求失败：${response.statusCode}`);
}

request.login = login;
request.clearToken = () => wx.removeStorageSync(TOKEN_STORAGE_KEY);

module.exports = request;
