const expenseService = require('./expenseService');
const storageService = require('./storageService');

const USER_ID = 'local-user';
const DEFAULT_THRESHOLD = 0.8;

function getCurrentMonth() {
  const date = new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

function getCurrentYear() {
  return `${new Date().getFullYear()}`;
}

function getDefaultPeriod(budgetType) {
  return budgetType === 'year' ? getCurrentYear() : getCurrentMonth();
}

function normalizeBudget(budget) {
  const budgetType = budget.budgetType === 'year' ? 'year' : 'month';
  const period = budget.period || getDefaultPeriod(budgetType);
  return {
    budgetId: budget.budgetId || `budget_${budgetType}_${period}`,
    budgetType,
    amount: Number(budget.amount || 0),
    period,
    threshold: Number(budget.threshold || DEFAULT_THRESHOLD)
  };
}

function validateBudget(budget) {
  const nextBudget = normalizeBudget(budget);
  if (!nextBudget.amount || nextBudget.amount <= 0) {
    return { valid: false, message: '请输入大于 0 的预算金额' };
  }
  if (nextBudget.threshold <= 0 || nextBudget.threshold > 1) {
    return { valid: false, message: '提醒阈值需在 1% 到 100% 之间' };
  }
  if (!nextBudget.period) {
    return { valid: false, message: '请填写预算周期' };
  }
  return { valid: true, data: nextBudget };
}

function getBudget(budgetType = 'month', period = getDefaultPeriod(budgetType)) {
  const budgets = storageService.getCollection(USER_ID, 'budgets');
  const targetType = budgetType === 'year' ? 'year' : 'month';
  const targetPeriod = period || getDefaultPeriod(targetType);
  return (
    budgets.find((item) => item.budgetType === targetType && item.period === targetPeriod) || {
    budgetId: `budget_${targetType}_${targetPeriod}`,
    budgetType: targetType,
    amount: 0,
    threshold: DEFAULT_THRESHOLD,
    period: targetPeriod
    }
  );
}

function saveBudget(budget) {
  const validation = validateBudget(budget);
  if (!validation.valid) {
    return validation;
  }
  const nextBudget = validation.data;
  const budgets = storageService.getCollection(USER_ID, 'budgets');
  const nextBudgets = budgets.filter(
    (item) => !(item.budgetType === nextBudget.budgetType && item.period === nextBudget.period)
  );
  storageService.setCollection(USER_ID, 'budgets', [nextBudget, ...nextBudgets]);
  return { valid: true, data: nextBudget };
}

function isExpenseInPeriod(expense, budgetType, period) {
  if (!expense.date) {
    return false;
  }
  if (budgetType === 'year') {
    return expense.date.slice(0, 4) === period;
  }
  return expense.date.slice(0, 7) === period;
}

function getPeriodExpenses(budgetType = 'month', period = getDefaultPeriod(budgetType)) {
  return expenseService
    .listExpenses()
    .filter((item) => item.includeInTotal !== false && isExpenseInPeriod(item, budgetType, period));
}

function getBudgetProgress(budgetType = 'month', period = getDefaultPeriod(budgetType)) {
  const budget = getBudget(budgetType, period);
  const periodExpenses = getPeriodExpenses(budget.budgetType, budget.period);
  const totalAmount = periodExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const usedRate = budget.amount > 0 ? totalAmount / budget.amount : 0;
  const thresholdPercent = Math.round(budget.threshold * 100);
  return {
    budget,
    totalAmount,
    remainingAmount: Math.max(budget.amount - totalAmount, 0),
    usedRate,
    percent: Math.min(Math.round(usedRate * 100), 999),
    thresholdPercent,
    isOverThreshold: budget.amount > 0 && usedRate >= budget.threshold,
    isOverBudget: budget.amount > 0 && usedRate > 1
  };
}

function getCategoryStats(budgetType = 'month', period = getDefaultPeriod(budgetType)) {
  const periodExpenses = getPeriodExpenses(budgetType, period);
  const totalAmount = periodExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const map = {};
  periodExpenses.forEach((item) => {
    if (!map[item.category]) {
      map[item.category] = {
        category: item.category,
        categoryName: item.categoryName,
        amount: 0,
        count: 0
      };
    }
    map[item.category].amount += Number(item.amount || 0);
    map[item.category].count += 1;
  });
  return Object.keys(map)
    .map((key) => ({
      ...map[key],
      percent: totalAmount > 0 ? Math.round((map[key].amount / totalAmount) * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount);
}

function getMonthTrend(limit = 6) {
  const expenses = expenseService.listExpenses().filter((item) => item.includeInTotal !== false && item.date);
  const map = {};
  expenses.forEach((item) => {
    const month = item.date.slice(0, 7);
    map[month] = (map[month] || 0) + Number(item.amount || 0);
  });
  const months = Object.keys(map).sort().slice(-limit);
  const maxAmount = Math.max(...months.map((month) => map[month]), 0);
  return months.map((month) => ({
    month,
    amount: map[month],
    percent: maxAmount > 0 ? Math.round((map[month] / maxAmount) * 100) : 0
  }));
}

function getBudgetDashboard(budgetType = 'month', period = getDefaultPeriod(budgetType)) {
  return {
    progress: getBudgetProgress(budgetType, period),
    categoryStats: getCategoryStats(budgetType, period),
    monthTrend: getMonthTrend()
  };
}

module.exports = {
  getCurrentMonth,
  getCurrentYear,
  getDefaultPeriod,
  getBudget,
  saveBudget,
  validateBudget,
  getPeriodExpenses,
  getBudgetProgress,
  getCategoryStats,
  getMonthTrend,
  getBudgetDashboard
};
