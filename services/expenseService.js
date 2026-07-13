const stageService = require('./stageService');
const apiService = require('./apiService');
const config = require('./config');

const USER_ID = config.userId || 'local-user';
const EXPENSE_API_BASE_URL = config.expenseApiBaseUrl || config.apiBaseUrl;
const expenseTypes = [
  {
    id: 'meet',
    name: '见面',
    subTypes: [
      { id: 'concert', name: '演唱会' },
      { id: 'new_year_concert', name: '新年音乐会' },
      { id: 'sports_day', name: '运动会' }
    ]
  },
  {
    id: 'collection',
    name: '藏品',
    subTypes: [
      { id: 'goods', name: '周边' },
      { id: 'magazine', name: '杂志' },
      { id: 'gift', name: '伴手礼' },
      { id: 'support_wear', name: '应援服' }
    ]
  },
  {
    id: 'accommodation',
    name: '住宿',
    subTypes: [{ id: 'hotel', name: '酒店/住宿' }]
  },
  {
    id: 'transport',
    name: '交通',
    subTypes: [{ id: 'travel', name: '交通出行' }]
  },
  {
    id: 'other',
    name: '其他',
    subTypes: [{ id: 'other', name: '其他消费' }]
  }
];
const searchableItems = [];
const expenseCategories = expenseTypes;
const feeLabels = {};
const MAX_NAME_LENGTH = 80;
const MAX_TEXT_LENGTH = 120;
const MAX_REMARK_LENGTH = 160;
const MAX_COLLECTION_QUANTITY = 100;
let expenseListCache = [];
const legacyCollectionSubTypes = {
  album: { id: 'album', name: '实体专辑' },
  other_collection: { id: 'other_collection', name: '其他藏品' }
};

function getMainType(mainTypeId) {
  return expenseTypes.find((item) => item.id === mainTypeId);
}

function getSubType(mainTypeId, subTypeId) {
  const mainType = getMainType(mainTypeId);
  if (!mainType) {
    return null;
  }
  return mainType.subTypes.find((item) => item.id === subTypeId) ||
    (mainTypeId === 'collection' ? legacyCollectionSubTypes[subTypeId] : null);
}

function inferCollectionSubType(collection = {}) {
  const text = [
    collection.collectionCategory,
    collection.category,
    collection.primaryCategory,
    collection.secondaryCategory,
    collection.productStyle,
    collection.collectionName
  ].filter(Boolean).join(' ');

  if (/应援服|服装|衣服|T恤|卫衣|support/i.test(text)) {
    return 'support_wear';
  }
  if (/伴手礼|票根赠品|赠品|gift/i.test(text)) {
    return 'gift';
  }
  if (/杂志|刊物|magazine/i.test(text)) {
    return 'magazine';
  }
  return 'goods';
}

function getCategoryName(categoryId, subTypeId) {
  const mainType = getMainType(categoryId);
  const subType = getSubType(categoryId, subTypeId);
  if (!mainType) {
    return '其他消费';
  }
  if (categoryId === 'transport' || categoryId === 'accommodation') {
    return mainType.name;
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
    premium: 0,
    travel: 0,
    hotel: 0,
    rental: 0,
    other: 0,
    shipping: 0
  };
}

function calculateTotalAmount(expense) {
  return calculateBaseAmount(expense);
}

function calculateBaseAmount(expense) {
  const amount = toNumber(expense.amount);
  const quantity = toNumber(expense.quantity || 1);

  switch (expense.pricingMode) {
    case 'official_unit':
    case 'unit':
      return amount * quantity;

    case 'total':
    case 'direct':
    default:
      return amount;
  }
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
  const nextItem = {
    ...item,
    outfieldOnly: false,
    includeInTotal: item.includeInTotal !== false,
    images: [],
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
  return expenseListCache;
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
    seat: (expense.seat || '').trim(),
    location: (expense.location || '').trim(),
    remark: (expense.remark || '').trim(),
    images: [],
    fees: normalizeFees(expense.fees),
    outfieldOnly: false,
    includeInTotal: expense.includeInTotal !== false,
    collectionId: expense.collectionId || '',
    stageId: expense.stageId || '',
    stageDate: expense.stageDate || '',
    priceTier: expense.priceTier || '',
    city: (expense.city || '').trim(),
    purchaseChannel: expense.purchaseChannel || 'none',
    pricingMode: expense.pricingMode || 'direct',
    referencePrice:
      expense.referencePrice === null || expense.referencePrice === ''
        ? null
        : Number(expense.referencePrice || 0),
    unitPrice:
      expense.unitPrice === null || expense.unitPrice === ''
        ? null
        : Number(expense.unitPrice || 0),
    expenseSource: expense.expenseSource || 'manual'
  };
}

function getTodayText() {
  const date = new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function isValidDateText(dateText) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(dateText || ''));
}

function validateExpense(expense) {
  const nextExpense = normalizeExpense(expense);
  const amountText = String(expense.amount || '').trim();
  if (!nextExpense.itemName) {
    return { valid: false, message: '请填写消费项目名称' };
  }
  if (!nextExpense.date) {
    return { valid: false, message: '请选择消费日期' };
  }
  if (!isValidDateText(nextExpense.date)) {
    return { valid: false, message: '消费日期格式不正确' };
  }
  if (nextExpense.date > getTodayText()) {
    return { valid: false, message: '消费日期不能晚于今天' };
  }
  if (nextExpense.category === 'meet' && !nextExpense.stageDate) {
    return { valid: false, message: '请选择见面日期' };
  }
  if (nextExpense.category === 'meet') {
    if (!isValidDateText(nextExpense.stageDate)) {
      return { valid: false, message: '见面日期格式不正确' };
    }
    if (nextExpense.date > nextExpense.stageDate) {
      return { valid: false, message: '消费日期不能晚于见面日期' };
    }
  }
  if (nextExpense.itemName.length > MAX_NAME_LENGTH) {
    return { valid: false, message: `项目名称上限为 ${MAX_NAME_LENGTH} 个字` };
  }
  if (nextExpense.remark.length > MAX_REMARK_LENGTH) {
    return { valid: false, message: `备注上限为 ${MAX_REMARK_LENGTH} 个字` };
  }
  if (
    nextExpense.city.length > MAX_TEXT_LENGTH ||
    nextExpense.location.length > MAX_TEXT_LENGTH ||
    nextExpense.seat.length > MAX_TEXT_LENGTH
  ) {
    return { valid: false, message: `城市、地点或座位上限为 ${MAX_TEXT_LENGTH} 个字` };
  }
  if (!nextExpense.amount || nextExpense.amount <= 0) {
    return { valid: false, message: '请输入大于 0 的金额' };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(amountText)) {
    return { valid: false, message: '金额最多保留两位小数' };
  }
  if (nextExpense.amount > 1000000) {
    return { valid: false, message: '金额不能超过 100 万元' };
  }
  if (!expenseCategories.some((item) => item.id === nextExpense.category)) {
    return { valid: false, message: '消费分类不正确' };
  }
  if (nextExpense.category === 'collection') {
    if (
      !Number.isInteger(nextExpense.quantity) ||
      nextExpense.quantity < 1 ||
      nextExpense.quantity > MAX_COLLECTION_QUANTITY
    ) {
      return { valid: false, message: `藏品数量必须是 1 到 ${MAX_COLLECTION_QUANTITY} 之间的整数` };
    }
  } else if (!nextExpense.quantity || nextExpense.quantity <= 0) {
    return { valid: false, message: '请输入大于 0 的数量' };
  }
  return { valid: true, data: nextExpense };
}

function syncStageLight(expense) {
  if (expense.category === 'meet' && expense.stageId) {
    stageService.lightStage(expense.stageId).then(() => {
      if (expense.expenseId) {
        return stageService.linkStageExpense(expense.stageId, expense.expenseId);
      }
      return null;
    }).catch((error) => {
      console.warn('同步舞台点亮状态失败', error);
    });
  }
}

async function syncDeletedExpenseLinksAsync(removed) {
  if (!removed) {
    return;
  }
  const expenses = await listExpensesAsync();

  if (removed.stageId) {
    const remainingStageExpense = expenses.find((item) => item.stageId === removed.stageId);
    if (remainingStageExpense) {
      await stageService.linkStageExpense(
        removed.stageId,
        remainingStageExpense.expenseId,
        Number(remainingStageExpense.priceTier || remainingStageExpense.amount || 0)
      );
    } else {
      await stageService.unlightStage(removed.stageId);
    }
  }

}

function addExpense(expense) {
  return {
    valid: false,
    message: '消费记录已切换为云端存储，请使用 addExpenseAsync'
  };
}

function updateExpense(expenseId, expense) {
  return {
    valid: false,
    message: '消费记录已切换为云端存储，请使用 updateExpenseAsync'
  };
}

function removeExpense(expenseId) {
  return false;
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
  const data = await apiService.request({
    baseUrl: EXPENSE_API_BASE_URL,
    url: `/expenses${apiService.buildQuery({ userId: USER_ID })}`
  });
  expenseListCache = (data || []).map(enrichExpense);
  require('./storageService').setCollection(USER_ID, 'expenses', expenseListCache);
  return expenseListCache;
}

async function listMeetStagesAsync() {
  try {
    const data = await apiService.request({
      baseUrl: EXPENSE_API_BASE_URL,
      url: '/expenses/meet-stages'
    });
    return data || [];
  } catch (error) {
    console.warn('meet stages api failed, fallback to stage cache', error);
  }
  await stageService.ensureStagesLoaded();
  return stageService.listStages();
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
  const validation = validateExpense(expense);
  if (!validation.valid) {
    return validation;
  }
  try {
    const data = await apiService.request({
      baseUrl: EXPENSE_API_BASE_URL,
      url: '/expenses',
      method: 'POST',
      data: {
        ...validation.data,
        userId: USER_ID
      }
    });
    const nextExpense = enrichExpense(data);
    expenseListCache = [nextExpense, ...expenseListCache.filter((item) => item.expenseId !== nextExpense.expenseId)];
    require('./storageService').setCollection(USER_ID, 'expenses', expenseListCache);
    syncStageLight(nextExpense);
    return { valid: true, data: nextExpense };
  } catch (error) {
    return { valid: false, message: error.message };
  }
}

async function updateExpenseAsync(expenseId, expense) {
  const validation = validateExpense({
    ...expense,
    expenseId
  });
  if (!validation.valid) {
    return validation;
  }
  try {
    const data = await apiService.request({
      baseUrl: EXPENSE_API_BASE_URL,
      url: `/expenses/${expenseId}`,
      method: 'PUT',
      data: {
        ...validation.data,
        userId: USER_ID
      }
    });
    const nextExpense = enrichExpense(data);
    expenseListCache = expenseListCache.map((item) => (
      item.expenseId === nextExpense.expenseId ? nextExpense : item
    ));
    require('./storageService').setCollection(USER_ID, 'expenses', expenseListCache);
    syncStageLight(nextExpense);
    return { valid: true, data: nextExpense };
  } catch (error) {
    return { valid: false, message: error.message };
  }
}

async function removeExpenseAsync(expenseId, removedExpense = null) {
  const removed = removedExpense || (await listExpensesAsync()).find((item) => item.expenseId === expenseId);
  await apiService.request({
    baseUrl: EXPENSE_API_BASE_URL,
    url: `/expenses/${expenseId}${apiService.buildQuery({ userId: USER_ID })}`,
    method: 'DELETE'
  });
  expenseListCache = expenseListCache.filter((item) => item.expenseId !== expenseId);
  require('./storageService').setCollection(USER_ID, 'expenses', expenseListCache);
  await syncDeletedExpenseLinksAsync(removed);
  return true;
}

module.exports = {
  expenseCategories,
  searchableItems,
  getMainType,
  getSubType,
  inferCollectionSubType,
  getCategoryName,
  calculateTotalAmount,
  calculateIncludedAmount,
  formatMoney,
  listExpenses,
  filterExpenses,
  listExpensesAsync,
  listMeetStagesAsync,
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
