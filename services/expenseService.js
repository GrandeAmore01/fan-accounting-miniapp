const storageService = require('./storageService');
const stageService = require('./stageService');
const { expenseTypes, searchableItems } = require('../data/expenseTypes');

const USER_ID = 'local-user';
const expenseCategories = expenseTypes;

function getMainType(mainTypeId) {
  return expenseTypes.find((item) => item.id === mainTypeId);
}

function getSubType(mainTypeId, subTypeId) {
  const mainType = getMainType(mainTypeId);
  if (!mainType) {
    return null;
  }
  return mainType.subTypes.find((item) => item.id === subTypeId);
}

function getCategoryName(categoryId, subTypeId) {
  const mainType = getMainType(categoryId);
  const subType = getSubType(categoryId, subTypeId);
  if (!mainType) {
    return '其他消费';
  }
  return subType ? `${mainType.name} / ${subType.name}` : mainType.name;
}

function toNumber(value) {
  return Number(value || 0);
}

function normalizeFees(fees = {}) {
  return {
    premium: toNumber(fees.premium),
    travel: toNumber(fees.travel),
    hotel: toNumber(fees.hotel),
    rental: toNumber(fees.rental),
    other: toNumber(fees.other),
    shipping: toNumber(fees.shipping)
  };
}

function calculateTotalAmount(expense) {
  const fees = normalizeFees(expense.fees);
  return (
    toNumber(expense.amount) * toNumber(expense.quantity || 1) +
    fees.premium +
    fees.travel +
    fees.hotel +
    fees.rental +
    fees.other +
    fees.shipping
  );
}

function shouldIncludeExpense(expense) {
  return !expense.outfieldOnly && expense.includeInTotal !== false;
}

function calculateIncludedAmount(expense) {
  return shouldIncludeExpense(expense) ? calculateTotalAmount(expense) : 0;
}

function listExpenses() {
  return storageService.getCollection(USER_ID, 'expenses').map((item) => {
    const outfieldOnly = Boolean(item.outfieldOnly);
    const nextItem = {
      ...item,
      outfieldOnly,
      includeInTotal: outfieldOnly ? false : item.includeInTotal !== false,
      images: item.images || [],
      fees: normalizeFees(item.fees)
    };
    return {
      ...nextItem,
      categoryName: getCategoryName(nextItem.category, nextItem.subType),
      totalAmount: calculateTotalAmount(nextItem),
      includedAmount: calculateIncludedAmount(nextItem)
    };
  });
}

function normalizeExpense(expense) {
  return {
    expenseId: expense.expenseId || `expense_${Date.now()}`,
    category: expense.category || 'meet',
    subType: expense.subType || 'concert',
    itemName: (expense.itemName || '').trim(),
    amount: Number(expense.amount || 0),
    quantity: Number(expense.quantity || 1),
    date: expense.date || '',
    paymentMethod: expense.paymentMethod || '',
    remark: (expense.remark || '').trim(),
    images: (expense.images || []).slice(0, 9),
    fees: normalizeFees(expense.fees),
    outfieldOnly: Boolean(expense.outfieldOnly),
    includeInTotal: expense.outfieldOnly ? false : expense.includeInTotal !== false,
    collectionId: expense.collectionId || '',
    stageId: expense.stageId || '',
    stageDate: expense.stageDate || '',
    priceTier: expense.priceTier || ''
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
  if (nextExpense.images.length > 9) {
    return { valid: false, message: '图片最多上传 9 张' };
  }
  if (!nextExpense.amount || nextExpense.amount <= 0) {
    return { valid: false, message: '请输入大于 0 的金额' };
  }
  if (!nextExpense.quantity || nextExpense.quantity <= 0) {
    return { valid: false, message: '请输入大于 0 的数量' };
  }
  return { valid: true, data: nextExpense };
}

function syncStageLight(expense) {
  if (expense.category === 'meet' && expense.stageId) {
    stageService.lightStage(expense.stageId);
  }
}

function addExpense(expense) {
  const validation = validateExpense(expense);
  if (!validation.valid) {
    return validation;
  }
  const expenses = storageService.getCollection(USER_ID, 'expenses');
  const nextExpense = validation.data;
  storageService.setCollection(USER_ID, 'expenses', [nextExpense, ...expenses]);
  syncStageLight(nextExpense);
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
  syncStageLight(validation.data);
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
  const totalAmount = expenses.reduce((sum, item) => sum + calculateIncludedAmount(item), 0);
  return {
    totalAmount,
    count: expenses.length
  };
}

module.exports = {
  expenseCategories,
  searchableItems,
  getMainType,
  getSubType,
  getCategoryName,
  calculateTotalAmount,
  calculateIncludedAmount,
  listExpenses,
  filterExpenses,
  addExpense,
  updateExpense,
  removeExpense,
  validateExpense,
  getExpenseSummary
};
