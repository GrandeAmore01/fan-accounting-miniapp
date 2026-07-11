const config = require('./config');
const cloudRequest = require('../utils/request');

function request(options) {
  const baseUrl = options.baseUrl || config.apiBaseUrl;

  return cloudRequest({
    path: `${baseUrl}${options.url}`,
    method: options.method || 'GET',
    data: options.data || {},
    header: options.header || {}
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
