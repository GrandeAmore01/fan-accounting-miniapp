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

function formatDate(value) {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function inferStageType(row) {
  const name = row.stage_name || '';
  if (name.includes('新年音乐会')) {
    return 'new_year_concert';
  }
  if (name.includes('运动会')) {
    return 'sports_day';
  }
  return row.stage_type || 'concert';
}


function getStageTicketPrice(expense) {
  const priceTier = Number(expense.priceTier || 0);
  if (Number.isFinite(priceTier) && priceTier > 0) {
    return priceTier;
  }
  const amount = Number(expense.amount || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

async function syncLinkedCollection(connection, expense) {
  if (expense.category !== 'collection' || !expense.collectionId) {
    return;
  }

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

async function syncLinkedStage(connection, expense) {
  if (expense.category !== 'meet' || !expense.stageId) {
    return;
  }

  const actualTicketPrice = getStageTicketPrice(expense);
  await connection.execute(
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
    [
      expense.userId,
      expense.stageId,
      expense.expenseId,
      actualTicketPrice,
      expense.expenseId,
      actualTicketPrice,
      actualTicketPrice
    ]
  );
}

async function clearPreviousStageLink(connection, expense) {
  await connection.execute(
    `UPDATE user_stages
     SET expense_id = ''
     WHERE user_id = ?
       AND expense_id = ?
       AND stage_id <> ?`,
    [expense.userId, expense.expenseId, expense.stageId || '']
  );
}

async function syncDeletedStageLink(connection, expense) {
  if (!expense.stageId) {
    return;
  }

  const [remainingRows] = await connection.execute(
    `SELECT expense_id, price_tier, amount
     FROM expenses
     WHERE user_id = ?
       AND stage_id = ?
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    [expense.userId, expense.stageId]
  );

  if (remainingRows.length) {
    const remaining = remainingRows[0];
    const actualTicketPrice = Number(remaining.price_tier || remaining.amount || 0);
    await connection.execute(
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
      [
        expense.userId,
        expense.stageId,
        remaining.expense_id,
        actualTicketPrice,
        remaining.expense_id,
        actualTicketPrice,
        actualTicketPrice
      ]
    );
    return;
  }

  await connection.execute(
    `INSERT INTO user_stages (
       user_id, stage_id, is_lighted, light_time, expense_id, actual_ticket_price
     ) VALUES (?, ?, 0, NULL, '', 0)
     ON DUPLICATE KEY UPDATE
       is_lighted = 0,
       light_time = NULL,
       expense_id = '',
       actual_ticket_price = 0`,
    [expense.userId, expense.stageId]
  );

  await connection.execute(
    `DELETE FROM stage_notes WHERE user_id = ? AND stage_id = ?`,
    [expense.userId, expense.stageId]
  );
}

async function syncDeletedCollectionLink(connection, expense) {
  if (!expense.collectionId) {
    return;
  }

  const [remainingRows] = await connection.execute(
    `SELECT expense_id
     FROM expenses
     WHERE user_id = ?
       AND collection_id = ?
     LIMIT 1`,
    [expense.userId, expense.collectionId]
  );

  if (remainingRows.length) {
    return;
  }

  await connection.execute(
    `INSERT INTO user_collections (
       user_id, collection_id, is_owned, light_time
     ) VALUES (?, ?, 0, NULL)
     ON DUPLICATE KEY UPDATE
       is_owned = 0,
       light_time = NULL`,
    [expense.userId, expense.collectionId]
  );
}

router.get('/meet-stages', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         s.stage_id,
         s.stage_name,
         s.stage_type,
         s.stage_date,
         s.city,
         s.venue,
         s.location,
         p.price_tier,
         p.sort_order
       FROM stages s
       LEFT JOIN stage_ticket_prices p ON p.stage_id = s.stage_id
       ORDER BY s.stage_date ASC, s.stage_id ASC, p.sort_order ASC`
    );

    const stageMap = {};
    rows.forEach((row) => {
      if (!stageMap[row.stage_id]) {
        stageMap[row.stage_id] = {
          stageId: row.stage_id,
          stageName: row.stage_name || '',
          stageType: inferStageType(row),
          date: formatDate(row.stage_date),
          city: row.city || '',
          venue: row.venue || '',
          location: row.venue || row.location || '',
          priceTiers: []
        };
      }
      const priceTier = Number(row.price_tier);
      if (Number.isFinite(priceTier) && priceTier > 0) {
        stageMap[row.stage_id].priceTiers.push(priceTier);
      }
    });

    res.json({
      ok: true,
      data: Object.keys(stageMap).map((stageId) => stageMap[stageId])
    });
  } catch (error) {
    next(error);
  }
});

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
    
      await syncLinkedCollection(connection, expense);
      await syncLinkedStage(connection, expense);
    
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
    const connection = await pool.getConnection();
    let result;
    try {
      await connection.beginTransaction();

      [result] = await connection.execute(
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

      if (result.affectedRows) {
        await clearPreviousStageLink(connection, expense);
        await syncLinkedCollection(connection, expense);
        await syncLinkedStage(connection, expense);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

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
  let connection;
  try {
    const userId = getUserId(req);
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT *
       FROM expenses
       WHERE expense_id = ? AND user_id = ?
       LIMIT 1`,
      [req.params.expenseId, userId]
    );

    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        message: '\u6d88\u8d39\u8bb0\u5f55\u4e0d\u5b58\u5728'
      });
    }

    const removedExpense = rowToExpense(rows[0]);
    const [result] = await connection.execute(
      `DELETE FROM expenses
       WHERE expense_id = ? AND user_id = ?`,
      [req.params.expenseId, userId]
    );

    if (result.affectedRows) {
      await syncDeletedStageLink(connection, removedExpense);
      await syncDeletedCollectionLink(connection, removedExpense);
    }

    await connection.commit();

    return res.json({
      ok: true,
      data: {
        expenseId: req.params.expenseId
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
