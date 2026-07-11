const crypto = require('crypto');
const https = require('https');
const express = require('express');
const pool = require('../db');
const { createToken } = require('../utils/auth');

const router = express.Router();

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(new Error('微信登录响应格式错误'));
        }
      });
    }).on('error', reject);
  });
}

router.post('/login', async (req, res, next) => {
  try {
    const code = String(req.body.code || '').trim();
    const appId = String(process.env.WECHAT_APP_ID || '').trim();
    const appSecret = String(process.env.WECHAT_APP_SECRET || '').trim();
    if (!code) {
      return res.status(400).json({ ok: false, message: '缺少微信登录 code' });
    }
    if (!appId || !appSecret) {
      throw new Error('服务端未配置 WECHAT_APP_ID 或 WECHAT_APP_SECRET');
    }

    const query = new URLSearchParams({
      appid: appId,
      secret: appSecret,
      js_code: code,
      grant_type: 'authorization_code'
    });
    const session = await requestJson(`https://api.weixin.qq.com/sns/jscode2session?${query}`);
    if (!session.openid) {
      const error = new Error(session.errmsg || '微信登录失败');
      error.status = 401;
      throw error;
    }

    const userId = `wx_${crypto.createHash('sha256').update(session.openid).digest('hex').slice(0, 40)}`;
    await pool.execute(
      `INSERT INTO users (user_id, openid, nickname, login_status)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE openid = VALUES(openid), login_status = 1`,
      [userId, session.openid, '微信用户']
    );

    res.json({ ok: true, data: { token: createToken(userId), userId } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
