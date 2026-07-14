const feeKeys = ['premium', 'travel', 'hotel', 'rental', 'other', 'shipping'];
const VALID_CATEGORIES = [
  'meet',
  'collection',
  'transport',
  'accommodation',
  'other'
];
const MAX_NAME_LENGTH = 80;
const MAX_TEXT_LENGTH = 120;
const MAX_REMARK_LENGTH = 160;
const MAX_COLLECTION_QUANTITY = 100;

function toNumber(value) {
  return Number(value || 0);
}

function normalizeFees(fees = {}) {
  return feeKeys.reduce((result, key) => {
    result[key] = 0;
    return result;
  }, {});
}

function normalizeImages(images = []) {
  return [];
}

function getRemarkPlainText(remark = '') {
  return String(remark || '')
    .replace(/#[^\s#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function calculateTotalAmount(expense) {
  return calculateBaseAmount(expense);
}

function isConcertExpense(expense) {
  return expense.category === 'meet' && expense.subType === 'concert';
}

function calculateIncludedAmount(expense) {
  if (expense.includeInTotal === false) {
    return 0;
  }
  return calculateTotalAmount(expense);
}

function createExpenseId() {
  return `expense_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeExpense(input = {}, expenseId) {
  const base = {
    expenseId: expenseId || input.expenseId || createExpenseId(),
    userId: input.userId || 'local-user',
    category: input.category || 'meet',
    subType: input.subType || 'concert',
    itemName: String(input.itemName || '').trim(),
    amount: toNumber(input.amount),
    quantity: input.category === 'collection'
  ? toNumber(input.quantity || 1)
  : 1,
    date: input.date || '',
    paymentMethod: input.paymentMethod || '',
    seat: String(input.seat || '').trim(),
    location: String(input.location || '').trim(),
    remark: String(input.remark || '').trim(),
    images: normalizeImages(input.images),
    fees: normalizeFees(input.fees),
    outfieldOnly: false,
    includeInTotal: input.includeInTotal !== false,
    collectionId: input.collectionId || '',
    stageId: input.stageId || '',
    stageDate: input.stageDate || '',
    priceTier: input.priceTier || '',
    city: String(input.city || '').trim(),
    purchaseChannel: input.purchaseChannel || 'none',
    pricingMode: input.pricingMode || 'direct',
    referencePrice:
      input.referencePrice == null ||
      input.referencePrice === ''
        ? null
        : toNumber(input.referencePrice),
    unitPrice:
      input.unitPrice == null ||
      input.unitPrice === ''
        ? null
        : toNumber(input.unitPrice),
    expenseSource: input.expenseSource || 'manual',
  };

  return {
    ...base,
    baseAmount: calculateBaseAmount(base),
    totalAmount: calculateTotalAmount(base),
    includedAmount: calculateIncludedAmount(base)
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
  const amountText = String(expense.amount || '').trim();
  if (!expense.itemName) {
    return { valid: false, message: '请填写消费项目名称' };
  }
  if (!expense.date) {
    return { valid: false, message: '请选择消费日期' };
  }
  if (!isValidDateText(expense.date)) {
    return { valid: false, message: '消费日期格式不正确' };
  }
  if (expense.date > getTodayText()) {
    return { valid: false, message: '消费日期不能晚于今天' };
  }
  if (expense.category === 'meet' && !expense.stageDate) {
    return { valid: false, message: '请选择见面日期' };
  }
  if (expense.category === 'meet') {
    if (!isValidDateText(expense.stageDate)) {
      return { valid: false, message: '见面日期格式不正确' };
    }
  }
  if (String(expense.itemName || '').length > MAX_NAME_LENGTH) {
    return { valid: false, message: `项目名称上限为 ${MAX_NAME_LENGTH} 个字` };
  }
  if (getRemarkPlainText(expense.remark).length > MAX_REMARK_LENGTH) {
    return { valid: false, message: `备注上限为 ${MAX_REMARK_LENGTH} 个字` };
  }
  if (
    String(expense.city || '').length > MAX_TEXT_LENGTH ||
    String(expense.location || '').length > MAX_TEXT_LENGTH ||
    String(expense.seat || '').length > MAX_TEXT_LENGTH
  ) {
    return { valid: false, message: `城市、地点或座位上限为 ${MAX_TEXT_LENGTH} 个字` };
  }
  if (!expense.amount || expense.amount <= 0) {
    return { valid: false, message: '请输入大于 0 的金额' };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(amountText)) {
    return { valid: false, message: '金额最多保留两位小数' };
  }
  if (!expense.quantity || expense.quantity <= 0) {
    return { valid: false, message: '请输入大于 0 的数量' };
  }
  if (!VALID_CATEGORIES.includes(expense.category)) {
    return { valid: false, message: '消费分类不正确' };
  }

  if (expense.totalAmount <= 0) {
    return { valid: false, message: '金额必须大于0' };
  }

  if (expense.amount > 1000000) {
    return { valid: false, message: '金额不能超过100万元' };
  }

  if (
    expense.category === 'collection' &&
    (!Number.isInteger(expense.quantity) ||
      expense.quantity < 1 ||
      expense.quantity > MAX_COLLECTION_QUANTITY)
  ) {
    return {
      valid: false,
      message: `藏品数量必须是 1 到 ${MAX_COLLECTION_QUANTITY} 之间的整数`
    };
  }
  return { valid: true };
}

function parseJson(value, fallback) {
  if (!value) {
    return fallback;
  }
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
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

function rowToExpense(row) {
  return {
    expenseId: row.expense_id,
    userId: row.user_id,
    category: row.category,
    subType: row.sub_type,
    itemName: row.item_name,
    amount: Number(row.amount),
    quantity: Number(row.quantity),
    date: formatDate(row.expense_date),
    paymentMethod: row.payment_method || '',
    seat: row.seat || '',
    location: row.location || '',
    remark: row.remark || '',
    images: parseJson(row.images_json, []),
    fees: normalizeFees(parseJson(row.fees_json, {})),
    outfieldOnly: Boolean(row.outfield_only),
    includeInTotal: Boolean(row.include_in_total),
    collectionId: row.collection_id || '',
    stageId: row.stage_id || '',
    stageDate: row.stage_date || '',
    priceTier: row.price_tier || '',
    city: row.city || '',
    purchaseChannel: row.purchase_channel || 'none',
    pricingMode: row.pricing_mode || 'direct',
    referencePrice:
      row.reference_price === null
        ? null
        : Number(row.reference_price),
    unitPrice:
      row.unit_price === null
        ? null
        : Number(row.unit_price),
    expenseSource: row.expense_source || 'manual',
    baseAmount: Number(row.base_amount),
    totalAmount: Number(row.total_amount),
    includedAmount: Number(row.included_amount),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function expenseToParams(expense) {
  return {
    expenseId: expense.expenseId,
    userId: expense.userId,
    category: expense.category,
    subType: expense.subType,
    itemName: expense.itemName,
    amount: expense.amount,
    quantity: expense.quantity,
    expenseDate: expense.date,
    paymentMethod: expense.paymentMethod,
    seat: expense.seat,
    location: expense.location,
    remark: expense.remark,
    imagesJson: JSON.stringify(expense.images),
    feesJson: JSON.stringify(expense.fees),
    outfieldOnly: expense.outfieldOnly ? 1 : 0,
    includeInTotal: expense.includeInTotal ? 1 : 0,
    collectionId: expense.collectionId,
    stageId: expense.stageId,
    stageDate: expense.stageDate,
    priceTier: expense.priceTier,
    city: expense.city,
    purchaseChannel: expense.purchaseChannel,
    pricingMode: expense.pricingMode,
    referencePrice: expense.referencePrice,
    unitPrice: expense.unitPrice,
    expenseSource: expense.expenseSource,
    baseAmount: expense.baseAmount,
    totalAmount: expense.totalAmount,
    includedAmount: expense.includedAmount
  };
}

module.exports = {
  normalizeExpense,
  validateExpense,
  rowToExpense,
  expenseToParams
};
