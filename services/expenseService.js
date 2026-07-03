const storageService = require('./storageService');

const USER_ID = 'local-user';

function listExpenses() {
  return storageService.getCollection(USER_ID, 'expenses');
}

function addExpense(expense) {
  const expenses = listExpenses();
  const nextExpense = {
    expenseId: `expense_${Date.now()}`,
    category: expense.category || 'other',
    itemName: expense.itemName || '',
    amount: Number(expense.amount || 0),
    quantity: Number(expense.quantity || 1),
    date: expense.date || '',
    paymentMethod: expense.paymentMethod || '',
    remark: expense.remark || '',
    includeInTotal: expense.includeInTotal !== false,
    collectionId: expense.collectionId || '',
    stageId: expense.stageId || ''
  };
  storageService.setCollection(USER_ID, 'expenses', [nextExpense, ...expenses]);
  return nextExpense;
}

function removeExpense(expenseId) {
  const expenses = listExpenses().filter((item) => item.expenseId !== expenseId);
  storageService.setCollection(USER_ID, 'expenses', expenses);
  return expenses;
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
  listExpenses,
  addExpense,
  removeExpense,
  getExpenseSummary
};
