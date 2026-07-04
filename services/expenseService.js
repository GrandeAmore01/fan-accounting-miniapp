const storageService = require('./storageService');
const stageService = require('./stageService');
const apiService = require('./apiService');
const config = require('./config');
const { expenseTypes, searchableItems } = require('../data/expenseTypes');

const USER_ID = config.userId || 'local-user';
const expenseCategories = expenseTypes;
const feeLabels = {
  premium: '加价',
  travel: '路费',
  hotel: '住宿',
  rental: '设备',
  other: '其他',
  shipping: '邮费'
};

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

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
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

function calculateBaseAmount(expense) {
  return toNumber(expense.amount) * toNumber(expense.quantity || 1);
}

function isConcertExpense(expense) {
  return expense.category === 'meet' && expense.subType === 'concert';
}

function shouldIncludeExpense(expense) {
  return expense.includeInTotal !== false;
}

function calculateIncludedAmount(expense) {
  if (!shouldIncludeExpense(expense)) {
    return 0;
  }
  if (isConcertExpense(expense) && expense.outfieldOnly) {
    return calculateBaseAmount(expense);
  }
  return calculateTotalAmount(expense);
}

function getFeeTags(fees = {}) {
  const normalizedFees = normalizeFees(fees);
  return Object.keys(feeLabels)
    .filter((key) => normalizedFees[key] > 0)
    .map((key) => ({
      key,
      label: feeLabels[key],
      amount: normalizedFees[key],
      amountText: formatMoney(normalizedFees[key])
    }));
}

function enrichExpense(item) {
  const outfieldOnly = Boolean(item.outfieldOnly);
  const nextItem = {
    ...item,
    outfieldOnly,
    includeInTotal: isConcertExpense(item) ? item.includeInTotal !== false : outfieldOnly ? false : item.includeInTotal !== false,
    images: item.images || [],
    fees: normalizeFees(item.fees)
  };
  return {
    ...nextItem,
    categoryName: getCategoryName(nextItem.category, nextItem.subType),
    baseAmount: calculateBaseAmount(nextItem),
    totalAmount: calculateTotalAmount(nextItem),
    includedAmount: calculateIncludedAmount(nextItem),
    feeTags: getFeeTags(nextItem.fees)
  };
}

function listExpenses() {
  return storageService.getCollection(USER_ID, 'expenses').map(enrichExpense);
}

function normalizeExpense(expense) {
  const outfieldOnly = Boolean(expense.outfieldOnly);
  const isConcert = expense.category === 'meet' && expense.subType === 'concert';
  return {
    expenseId: expense.expenseId || `expense_${Date.now()}`,
    category: expense.category || 'meet',
    subType: expense.subType || 'concert',
    itemName: (expense.itemName || '').trim(),
    amount: Number(expense.amount || 0),
    quantity: Number(expense.quantity || 1),
    date: expense.date || '',
    paymentMethod: expense.paymentMethod || '',
    seat: (expense.seat || '').trim(),
    location: (expense.location || '').trim(),
    remark: (expense.remark || '').trim(),
    images: (expense.images || []).slice(0, 9),
    fees: normalizeFees(expense.fees),
    outfieldOnly,
    includeInTotal: isConcert ? expense.includeInTotal !== false : outfieldOnly ? false : expense.includeInTotal !== false,
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
  return filterExpenseList(listExpenses(), filter);
}

function filterExpenseList(expenses, filter) {
  const keyword = (filter.keyword || '').trim();
  const category = filter.category || 'all';
  return expenses.filter((item) => {
    const categoryMatched = category === 'all' || item.category === category;
    const keywordMatched =
      !keyword ||
      item.itemName.indexOf(keyword) >= 0 ||
      item.location.indexOf(keyword) >= 0 ||
      item.seat.indexOf(keyword) >= 0 ||
      item.remark.indexOf(keyword) >= 0 ||
      item.date.indexOf(keyword) >= 0 ||
      item.categoryName.indexOf(keyword) >= 0;
    return categoryMatched && keywordMatched;
  });
}

function summarizeExpenses(expenses) {
  const totalAmount = expenses.reduce((sum, item) => sum + Number(item.includedAmount || 0), 0);
  const actualAmount = expenses.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  return {
    totalAmount,
    actualAmount,
    count: expenses.length
  };
}

function getExpenseSummary() {
  return summarizeExpenses(listExpenses());
}

function buildCategoryStats(expenses) {
  const stats = [
    {
      id: 'all',
      name: '全部消费',
      amount: expenses.reduce((sum, item) => sum + Number(item.includedAmount || 0), 0),
      actualAmount: expenses.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
      count: expenses.length
    },
    ...expenseCategories.map((category) => {
      const categoryExpenses = expenses.filter((item) => item.category === category.id);
      return {
        id: category.id,
        name: category.name,
        amount: categoryExpenses.reduce(
          (sum, item) => sum + Number(item.includedAmount || 0),
          0
        ),
        actualAmount: categoryExpenses.reduce(
          (sum, item) => sum + Number(item.totalAmount || 0),
          0
        ),
        count: categoryExpenses.length
      };
    })
  ];
  return stats;
}

function getCategoryStats() {
  return buildCategoryStats(listExpenses());
}

async function listExpensesAsync() {
  if (!config.useBackend) {
    return listExpenses();
  }
  const data = await apiService.request({
    url: `/expenses${apiService.buildQuery({ userId: USER_ID })}`
  });
  return (data || []).map(enrichExpense);
}

async function filterExpensesAsync(filter) {
  const expenses = await listExpensesAsync();
  return filterExpenseList(expenses, filter);
}

async function getExpenseSummaryAsync() {
  const expenses = await listExpensesAsync();
  return summarizeExpenses(expenses);
}

async function getCategoryStatsAsync() {
  const expenses = await listExpensesAsync();
  return buildCategoryStats(expenses);
}

async function addExpenseAsync(expense) {
  if (!config.useBackend) {
    return addExpense(expense);
  }
  const validation = validateExpense(expense);
  if (!validation.valid) {
    return validation;
  }
  try {
    const data = await apiService.request({
      url: '/expenses',
      method: 'POST',
      data: {
        ...validation.data,
        userId: USER_ID
      }
    });
    const nextExpense = enrichExpense(data);
    syncStageLight(nextExpense);
    return { valid: true, data: nextExpense };
  } catch (error) {
    return { valid: false, message: error.message };
  }
}

async function updateExpenseAsync(expenseId, expense) {
  if (!config.useBackend) {
    return updateExpense(expenseId, expense);
  }
  const validation = validateExpense({
    ...expense,
    expenseId
  });
  if (!validation.valid) {
    return validation;
  }
  try {
    const data = await apiService.request({
      url: `/expenses/${expenseId}`,
      method: 'PUT',
      data: {
        ...validation.data,
        userId: USER_ID
      }
    });
    const nextExpense = enrichExpense(data);
    syncStageLight(nextExpense);
    return { valid: true, data: nextExpense };
  } catch (error) {
    return { valid: false, message: error.message };
  }
}

async function removeExpenseAsync(expenseId) {
  if (!config.useBackend) {
    return removeExpense(expenseId);
  }
  await apiService.request({
    url: `/expenses/${expenseId}${apiService.buildQuery({ userId: USER_ID })}`,
    method: 'DELETE'
  });
  return true;
}

module.exports = {
  expenseCategories,
  searchableItems,
  getMainType,
  getSubType,
  getCategoryName,
  calculateTotalAmount,
  calculateIncludedAmount,
  formatMoney,
  listExpenses,
  filterExpenses,
  listExpensesAsync,
  filterExpensesAsync,
  addExpense,
  addExpenseAsync,
  updateExpense,
  updateExpenseAsync,
  removeExpense,
  removeExpenseAsync,
  validateExpense,
  getExpenseSummary,
  getExpenseSummaryAsync,
  getCategoryStats,
  getCategoryStatsAsync
};
