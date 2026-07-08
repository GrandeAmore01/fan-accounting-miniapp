const express = require('express');
const pool = require('../db');

const router = express.Router();

function requireFields(body, fields) {
  for (const field of fields) {
    if (!body[field]) {
      const error = new Error(`缺少参数：${field}`);
      error.status = 400;
      throw error;
    }
  }
}

router.get('/', async (req, res, next) => {
  try {
    const userId = String(req.query.userId || '').trim();

    if (!userId) {
      return res.status(400).json({
        ok: false,
        message: '缺少userId'
      });
    }

    const [rows] = await pool.execute(
      `SELECT
         c.collection_id,
         c.collection_name,
         c.category,
         c.reference_price,
         c.price_text,
         c.acquisition_type,
         COALESCE(uc.is_owned, 0) AS is_owned,
         uc.light_time
       FROM collections c
       LEFT JOIN user_collections uc
         ON uc.collection_id = c.collection_id
        AND uc.user_id = ?
       ORDER BY c.collection_id`,
      [userId]
    );

    res.json({
      ok: true,
      data: rows.map((row) => ({
        collectionId: row.collection_id,
        collectionName: row.collection_name,
        category: row.category,
        referencePrice:
          row.reference_price === null
            ? null
            : Number(row.reference_price),
        priceText: row.price_text,
        acquisitionType: row.acquisition_type,
        isOwned: Boolean(row.is_owned),
        lightTime: row.light_time
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.post('/light', async (req, res, next) => {
  try {
    requireFields(req.body, ['userId', 'collectionId']);

    const { userId, collectionId } = req.body;

    const [collections] = await pool.execute(
      `SELECT collection_id
       FROM collections
       WHERE collection_id = ?`,
      [collectionId]
    );

    if (!collections.length) {
      return res.status(404).json({
        ok: false,
        message: '藏品不存在'
      });
    }

    await pool.execute(
      `INSERT INTO user_collections (
         user_id, collection_id, is_owned, light_time
       ) VALUES (?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE
         is_owned = 1,
         light_time = COALESCE(light_time, NOW())`,
      [userId, collectionId]
    );

    res.json({
      ok: true,
      data: {
        userId,
        collectionId,
        isOwned: true
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/unlight', async (req, res, next) => {
  try {
    requireFields(req.body, ['userId', 'collectionId']);

    const { userId, collectionId } = req.body;

    await pool.execute(
      `INSERT INTO user_collections (
         user_id, collection_id, is_owned, light_time
       ) VALUES (?, ?, 0, NULL)
       ON DUPLICATE KEY UPDATE
         is_owned = 0,
         light_time = NULL`,
      [userId, collectionId]
    );

    res.json({
      ok: true,
      data: {
        userId,
        collectionId,
        isOwned: false
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;