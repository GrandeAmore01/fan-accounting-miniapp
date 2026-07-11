const express = require('express');
const pool = require('../db');

const router = express.Router();
const DEFAULT_DISPLAY_NAME = '微信用户';

function normalizeRow(row = {}) {
  return {
    displayName: row.display_name || DEFAULT_DISPLAY_NAME,
    avatarFileId: row.avatar_file_id || ''
  };
}

function validateDisplayName(value) {
  const displayName = String(value || '').trim();
  const length = Array.from(displayName).length;
  if (!displayName) {
    const error = new Error('昵称不能为空');
    error.status = 400;
    throw error;
  }
  if (length > 20) {
    const error = new Error('昵称不能超过20个字符');
    error.status = 400;
    throw error;
  }
  return displayName;
}

function validateAvatarFileId(value) {
  const avatarFileId = String(value || '').trim();
  if (avatarFileId && (!avatarFileId.startsWith('cloud://') || avatarFileId.length > 500)) {
    const error = new Error('头像文件标识不正确');
    error.status = 400;
    throw error;
  }
  return avatarFileId;
}

async function findProfile(userId) {
  const [rows] = await pool.execute(
    `SELECT display_name, avatar_file_id
     FROM users
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

router.get('/', async (req, res, next) => {
  try {
    const profile = await findProfile(req.auth.userId);
    if (!profile) {
      return res.status(404).json({ ok: false, message: '用户不存在' });
    }
    res.json({ ok: true, data: normalizeRow(profile) });
  } catch (error) {
    next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const hasDisplayName = Object.prototype.hasOwnProperty.call(body, 'displayName');
    const hasAvatarFileId = Object.prototype.hasOwnProperty.call(body, 'avatarFileId');
    if (!hasDisplayName && !hasAvatarFileId) {
      return res.status(400).json({ ok: false, message: '没有可保存的个人资料' });
    }

    const fields = [];
    const params = [];
    if (hasDisplayName) {
      fields.push('display_name = ?');
      params.push(validateDisplayName(body.displayName));
    }
    if (hasAvatarFileId) {
      fields.push('avatar_file_id = ?');
      params.push(validateAvatarFileId(body.avatarFileId));
    }
    params.push(req.auth.userId);

    const [result] = await pool.execute(
      `UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`,
      params
    );
    if (!result.affectedRows) {
      return res.status(404).json({ ok: false, message: '用户不存在' });
    }

    const profile = await findProfile(req.auth.userId);
    res.json({ ok: true, data: normalizeRow(profile) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
