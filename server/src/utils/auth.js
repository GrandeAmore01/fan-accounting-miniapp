const crypto = require('crypto');

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

function getSecret() {
  const secret = String(process.env.AUTH_TOKEN_SECRET || '');
  if (secret.length < 32) {
    throw new Error('AUTH_TOKEN_SECRET must contain at least 32 characters');
  }
  return secret;
}

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('base64url');
}

function createToken(userId) {
  const payload = encode(JSON.stringify({
    userId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  }));
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) {
    throw new Error('invalid token');
  }
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('invalid token');
  }
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!data.userId || Number(data.exp) <= Math.floor(Date.now() / 1000)) {
    throw new Error('expired token');
  }
  return data;
}

function requireAuth(req, res, next) {
  try {
    const authorization = String(req.get('authorization') || '');
    const token = authorization.replace(/^Bearer\s+/i, '');
    const identity = verifyToken(token);
    req.auth = identity;
    req.query.userId = identity.userId;
    if (req.body && typeof req.body === 'object') {
      req.body.userId = identity.userId;
    }
    next();
  } catch (error) {
    res.status(401).json({ ok: false, message: '登录状态无效，请重新进入小程序' });
  }
}

module.exports = { createToken, requireAuth };
