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

function rowToUserStage(row) {
  return {
    stageId: row.stage_id,
    isLighted: Boolean(row.is_lighted),
    lightTime: row.light_time ? new Date(row.light_time).toISOString() : '',
    expenseId: row.expense_id || '',
    actualTicketPrice: Number(row.actual_ticket_price || 0)
  };
}

router.get('/', async (req, res, next) => {
  try {
    const userId = String(req.query.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ ok: false, message: '缺少userId' });
    }

    const [rows] = await pool.execute(
      `SELECT user_id, stage_id, is_lighted, light_time, expense_id, actual_ticket_price
       FROM user_stages
       WHERE user_id = ?
       ORDER BY stage_id ASC`,
      [userId]
    );

    res.json({
      ok: true,
      data: rows.map(rowToUserStage)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/light', async (req, res, next) => {
  try {
    requireFields(req.body, ['userId', 'stageId']);
    const { userId, stageId } = req.body;
    const actualTicketPrice = Number(req.body.actualTicketPrice || 0);

    const [stages] = await pool.execute(
      `SELECT stage_id FROM stages WHERE stage_id = ?`,
      [stageId]
    );
    if (!stages.length) {
      return res.status(404).json({ ok: false, message: '舞台场次不存在' });
    }

    await pool.execute(
      `INSERT INTO user_stages (
         user_id, stage_id, is_lighted, light_time, expense_id, actual_ticket_price
       ) VALUES (?, ?, 1, NOW(), '', ?)
       ON DUPLICATE KEY UPDATE
         is_lighted = 1,
         light_time = COALESCE(light_time, NOW()),
         actual_ticket_price = CASE
           WHEN ? > 0 THEN ?
           ELSE actual_ticket_price
         END`,
      [userId, stageId, actualTicketPrice, actualTicketPrice, actualTicketPrice]
    );

    res.json({
      ok: true,
      data: { userId, stageId, isLighted: true }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/unlight', async (req, res, next) => {
  try {
    requireFields(req.body, ['userId', 'stageId']);
    const { userId, stageId } = req.body;

    await pool.execute(
      `INSERT INTO user_stages (
         user_id, stage_id, is_lighted, light_time, expense_id, actual_ticket_price
       ) VALUES (?, ?, 0, NULL, '', 0)
       ON DUPLICATE KEY UPDATE
         is_lighted = 0,
         light_time = NULL,
         expense_id = '',
         actual_ticket_price = 0`,
      [userId, stageId]
    );

    await pool.execute(
      `DELETE FROM stage_notes WHERE user_id = ? AND stage_id = ?`,
      [userId, stageId]
    );

    res.json({
      ok: true,
      data: { userId, stageId, isLighted: false }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/link-expense', async (req, res, next) => {
  try {
    requireFields(req.body, ['userId', 'stageId', 'expenseId']);
    const { userId, stageId, expenseId } = req.body;
    const actualTicketPrice = Number(req.body.actualTicketPrice || 0);

    await pool.execute(
      `INSERT INTO user_stages (
         user_id, stage_id, is_lighted, light_time, expense_id, actual_ticket_price
       ) VALUES (?, ?, 1, NOW(), ?, ?)
       ON DUPLICATE KEY UPDATE
         is_lighted = 1,
         light_time = COALESCE(light_time, NOW()),
         expense_id = ?,
         actual_ticket_price = CASE
           WHEN ? > 0 THEN ?
           ELSE actual_ticket_price
         END`,
      [userId, stageId, expenseId, actualTicketPrice, expenseId, actualTicketPrice, actualTicketPrice]
    );

    res.json({
      ok: true,
      data: { userId, stageId, expenseId, isLighted: true }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
