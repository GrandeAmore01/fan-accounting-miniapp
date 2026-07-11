const CLOUD_SERVICE_NAME = 'fan-accounting-api';

/**
 * 通过 CloudBase 云托管调用后端。
 * wx.cloud.init 在 app.js 中统一执行。
 */
function request(options) {
  return new Promise((resolve, reject) => {
    wx.cloud.callContainer({
      path: options.path,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'content-type': 'application/json',
        'X-WX-SERVICE': CLOUD_SERVICE_NAME,
        ...(options.header || {})
      },
      success(res) {
        const body = res.data || {};
        if (res.statusCode >= 200 && res.statusCode < 300 && body.ok !== false) {
          resolve(body.data);
          return;
        }
        reject(new Error(body.message || `请求失败：${res.statusCode}`));
      },
      fail(error) {
        reject(new Error(error.errMsg || '网络请求失败'));
      }
    });
  });
}

module.exports = request;
