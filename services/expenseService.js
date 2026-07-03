const storageService = require('./storageService');
const categories = require('../data/categories');

const USER_ID = 'local-user';
const expenseCategories = categories.filter((item) => item.type === 'expense' || item.type === 'collection');

function getCategoryName(categoryId) {
  const category = expenseCategories.find((item) => item.id === categoryId);
  return category ? category.name : '其他消费';
}

function listExpenses() {
  return storageService.getCollection(USER_ID, 'expenses').map((item) => ({
    ...item,
    categoryName: getCategoryName(item.category)
  }));
}

function normalizeExpense(expense) {
  return {
    expenseId: expense.expenseId || `expense_${Date.now()}`,
    category: expense.category || 'other',
    itemName: (expense.itemName || '').trim(),
    amount: Number(expense.amount || 0),
    quantity: Number(expense.quantity || 1),
    date: expense.date || '',
    paymentMethod: expense.paymentMethod || '',
    remark: (expense.remark || '').trim(),
    includeInTotal: expense.includeInTotal !== false,
    collectionId: expense.collectionId || '',
    stageId: expense.stageId || ''
  };
}

function validateExpense(expense) {
  const nextExpense = normalizeExpense(expense);
  if (!nextExpense.itemName) {
    return { valid: false, message: '请填写消费项目名称' };
  }
  if (!nextExpense.date) {
    return { valid: false, message: '请选择消费日期' };
  }
  if (!nextExpense.amount || nextExpense.amount <= 0) {
    return { valid: false, message: '请输入大于 0 的金额' };
  }
  if (!nextExpense.quantity || nextExpense.quantity <= 0) {
    return { valid: false, message: '请输入大于 0 的数量' };
  }
  return { valid: true, data: nextExpense };
}

function addExpense(expense) {
  const validation = validateExpense(expense);
  if (!validation.valid) {
    return validation;
  }
  const expenses = storageService.getCollection(USER_ID, 'expenses');
  const nextExpense = validation.data;
  storageService.setCollection(USER_ID, 'expenses', [nextExpense, ...expenses]);
  return { valid: true, data: nextExpense };
}

function updateExpense(expenseId, expense) {
  const validation = validateExpense({
    ...expense,
    expenseId
  });
  if (!validation.valid) {
    return validation;
  }
  const expenses = storageService.getCollection(USER_ID, 'expenses');
  const nextExpenses = expenses.map((item) => (item.expenseId === expenseId ? validation.data : item));
  storageService.setCollection(USER_ID, 'expenses', nextExpenses);
  return { valid: true, data: validation.data };
}

function removeExpense(expenseId) {
  const expenses = storageService.getCollection(USER_ID, 'expenses').filter((item) => item.expenseId !== expenseId);
  storageService.setCollection(USER_ID, 'expenses', expenses);
  return expenses;
}

function filterExpenses(filter) {
  const keyword = (filter.keyword || '').trim();
  const category = filter.category || 'all';
  return listExpenses().filter((item) => {
    const categoryMatched = category === 'all' || item.category === category;
    const keywordMatched = !keyword || item.itemName.indexOf(keyword) >= 0 || item.remark.indexOf(keyword) >= 0;
    return categoryMatched && keywordMatched;
  });
}

function getExpenseSummary() {
  const expenses = listExpenses();
  const includedExpenses = expenses.filter((item) => item.includeInTotal !== false);
  const totalAmount = includedExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return {
    totalAmount,
    count: expenses.length
  };
}

module.exports = {
  expenseCategories,
  listExpenses,
  filterExpenses,
  addExpense,
  updateExpense,
  removeExpense,
  validateExpense,
  getExpenseSummary
};
