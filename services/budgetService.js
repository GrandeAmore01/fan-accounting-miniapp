const expenseService = require('./expenseService');
const storageService = require('./storageService');

const USER_ID = 'local-user';

function getBudget() {
  const budgets = storageService.getCollection(USER_ID, 'budgets');
  return budgets[0] || {
    budgetId: 'budget_default',
    budgetType: 'month',
    amount: 0,
    threshold: 0.8,
    period: ''
  };
}

function saveBudget(budget) {
  const nextBudget = {
    budgetId: budget.budgetId || 'budget_default',
    budgetType: budget.budgetType || 'month',
    amount: Number(budget.amount || 0),
    threshold: Number(budget.threshold || 0.8),
    period: budget.period || ''
  };
  storageService.setCollection(USER_ID, 'budgets', [nextBudget]);
  return nextBudget;
}

function getBudgetProgress() {
  const budget = getBudget();
  const summary = expenseService.getExpenseSummary();
  const usedRate = budget.amount > 0 ? summary.totalAmount / budget.amount : 0;
  return {
    budget,
    totalAmount: summary.totalAmount,
    usedRate,
    percent: Math.min(Math.round(usedRate * 100), 999)
  };
}

module.exports = {
  getBudget,
  saveBudget,
  getBudgetProgress
};
