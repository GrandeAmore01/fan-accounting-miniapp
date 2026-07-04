const config = require('./config');

function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.apiBaseUrl}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'content-type': 'application/json',
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

function buildQuery(params = {}) {
  const query = Object.keys(params)
    .filter((key) => typeof params[key] !== 'undefined' && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
  return query ? `?${query}` : '';
}

module.exports = {
  request,
  buildQuery
};
