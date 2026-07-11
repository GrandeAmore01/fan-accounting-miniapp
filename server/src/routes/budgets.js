const express = require('express');
const pool = require('../db');

const router = express.Router();
const VALID_CATEGORIES = ['meet', 'collection', 'accommodation', 'transport', 'other'];

function parseCategoryBudgets(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (error) { return {}; }
}

function rowToBudget(row) {
  return {
    budgetId: row.budget_id,
    budgetType: row.budget_type,
    period: row.period,
    amount: Number(row.amount || 0),
    threshold: Number(row.threshold || 0.8),
    categoryBudgets: parseCategoryBudgets(row.category_budgets_json)
  };
}

function normalizeInput(input, userId) {
  const budgetType = input.budgetType === 'year' ? 'year' : 'month';
  const period = String(input.period || '').trim();
  const amount = Number(input.amount || 0);
  const threshold = Number(input.threshold || 0.8);
  if (!period || amount <= 0 || threshold <= 0 || threshold > 1) {
    const error = new Error('预算参数不正确');
    error.status = 400;
    throw error;
  }
  const source = input.categoryBudgets || {};
  const categoryBudgets = VALID_CATEGORIES.reduce((result, key) => {
    result[key] = Math.max(Number(source[key] || 0), 0);
    return result;
  }, {});
  const categoryTotal = Object.values(categoryBudgets).reduce((sum, value) => sum + value, 0);
  if (categoryTotal > amount) {
    const error = new Error('分类预算总额不能超过总预算');
    error.status = 400;
    throw error;
  }
  return {
    budgetId: `budget_${userId}_${budgetType}_${period}`,
    userId,
    budgetType,
    period,
    amount,
    threshold,
    categoryBudgets
  };
}

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT budget_id, budget_type, period, amount, threshold, category_budgets_json
       FROM budgets WHERE user_id = ? ORDER BY period DESC`,
      [req.auth.userId]
    );
    res.json({ ok: true, data: rows.map(rowToBudget) });
  } catch (error) {
    next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const budget = normalizeInput(req.body, req.auth.userId);
    await pool.execute(
      `INSERT INTO budgets (
         budget_id, user_id, budget_type, period, amount, threshold, category_budgets_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         amount = VALUES(amount), threshold = VALUES(threshold),
         category_budgets_json = VALUES(category_budgets_json)`,
      [budget.budgetId, budget.userId, budget.budgetType, budget.period,
        budget.amount, budget.threshold, JSON.stringify(budget.categoryBudgets)]
    );
    res.json({ ok: true, data: budget });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
