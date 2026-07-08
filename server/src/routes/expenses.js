const express = require('express');
const pool = require('../db');
const {
  expenseToParams,
  normalizeExpense,
  rowToExpense,
  validateExpense
} = require('../utils/expenseModel');

const router = express.Router();

function getUserId(req) {
  return req.query.userId || (req.body && req.body.userId) || 'local-user';
}

router.get('/', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const [rows] = await pool.execute(
      `SELECT *
       FROM expenses
       WHERE user_id = ?
       ORDER BY expense_date DESC, created_at DESC`,
      [userId]
    );
    res.json({
      ok: true,
      data: rows.map(rowToExpense)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:expenseId', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const [rows] = await pool.execute(
      `SELECT *
       FROM expenses
       WHERE expense_id = ? AND user_id = ?
       LIMIT 1`,
      [req.params.expenseId, userId]
    );
    if (!rows.length) {
      return res.status(404).json({ ok: false, message: '消费记录不存在' });
    }
    return res.json({
      ok: true,
      data: rowToExpense(rows[0])
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const expense = normalizeExpense({
      ...req.body,
      userId: getUserId(req)
    });
    const validation = validateExpense(expense);
    if (!validation.valid) {
      return res.status(400).json({ ok: false, message: validation.message });
    }

    const params = expenseToParams(expense);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
    
      await connection.execute(
        `INSERT INTO expenses (
          expense_id, user_id, category, sub_type, item_name, amount, quantity,
          expense_date, payment_method, seat, location, remark, images_json,
          fees_json, outfield_only, include_in_total, collection_id, stage_id,
          stage_date, price_tier, base_amount, total_amount, included_amount,
          city, purchase_channel, pricing_mode, reference_price, unit_price, expense_source
        ) VALUES (
          :expenseId, :userId, :category, :subType, :itemName, :amount, :quantity,
          :expenseDate, :paymentMethod, :seat, :location, :remark, :imagesJson,
          :feesJson, :outfieldOnly, :includeInTotal, :collectionId, :stageId,
          :stageDate, :priceTier, :baseAmount, :totalAmount, :includedAmount,
          :city, :purchaseChannel, :pricingMode, :referencePrice, :unitPrice, :expenseSource
        )`,
        params
      );
    
      if (expense.category === 'collection' && expense.collectionId) {
        await connection.execute(
          `INSERT INTO user_collections (
             user_id, collection_id, is_owned, light_time
           ) VALUES (?, ?, 1, NOW())
           ON DUPLICATE KEY UPDATE
             is_owned = 1,
             light_time = COALESCE(light_time, NOW())`,
          [expense.userId, expense.collectionId]
        );
      }
    
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return res.status(201).json({
      ok: true,
      data: expense
    });
  } catch (error) {
    // 捕获主键重复：expense_id 已存在
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        ok: false,
        message: '该消费记录已存在，请勿重复提交'
      });
    }
    next(error);
  }
});

router.put('/:expenseId', async (req, res, next) => {
  try {
    const expense = normalizeExpense(
      {
        ...req.body,
        userId: getUserId(req)
      },
      req.params.expenseId
    );
    const validation = validateExpense(expense);
    if (!validation.valid) {
      return res.status(400).json({ ok: false, message: validation.message });
    }

    const params = expenseToParams(expense);
    const [result] = await pool.execute(
      `UPDATE expenses
       SET category = :category,
           sub_type = :subType,
           item_name = :itemName,
           amount = :amount,
           quantity = :quantity,
           expense_date = :expenseDate,
           payment_method = :paymentMethod,
           seat = :seat,
           location = :location,
           remark = :remark,
           images_json = :imagesJson,
           fees_json = :feesJson,
           outfield_only = :outfieldOnly,
           include_in_total = :includeInTotal,
           collection_id = :collectionId,
           stage_id = :stageId,
           stage_date = :stageDate,
           price_tier = :priceTier,
           city = :city,
           purchase_channel = :purchaseChannel,
           pricing_mode = :pricingMode,
           reference_price = :referencePrice,
           unit_price = :unitPrice,
           expense_source = :expenseSource,
           base_amount = :baseAmount,
           total_amount = :totalAmount,
           included_amount = :includedAmount
       WHERE expense_id = :expenseId AND user_id = :userId`,
      params
    );

    if (!result.affectedRows) {
      return res.status(404).json({ ok: false, message: '消费记录不存在' });
    }

    return res.json({
      ok: true,
      data: expense
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:expenseId', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const [result] = await pool.execute(
      `DELETE FROM expenses
       WHERE expense_id = ? AND user_id = ?`,
      [req.params.expenseId, userId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ ok: false, message: '消费记录不存在' });
    }
    return res.json({
      ok: true,
      data: {
        expenseId: req.params.expenseId
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
