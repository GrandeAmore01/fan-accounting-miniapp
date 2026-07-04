const feeKeys = ['premium', 'travel', 'hotel', 'rental', 'other', 'shipping'];

function toNumber(value) {
  return Number(value || 0);
}

function normalizeFees(fees = {}) {
  return feeKeys.reduce((result, key) => {
    result[key] = toNumber(fees[key]);
    return result;
  }, {});
}

function normalizeImages(images = []) {
  return Array.isArray(images) ? images.slice(0, 9).map((item) => String(item)) : [];
}

function calculateBaseAmount(expense) {
  return toNumber(expense.amount) * toNumber(expense.quantity || 1);
}

function calculateTotalAmount(expense) {
  const fees = normalizeFees(expense.fees);
  return (
    calculateBaseAmount(expense) +
    fees.premium +
    fees.travel +
    fees.hotel +
    fees.rental +
    fees.other +
    fees.shipping
  );
}

function isConcertExpense(expense) {
  return expense.category === 'meet' && expense.subType === 'concert';
}

function calculateIncludedAmount(expense) {
  if (expense.includeInTotal === false) {
    return 0;
  }
  if (isConcertExpense(expense) && expense.outfieldOnly) {
    return calculateBaseAmount(expense);
  }
  return calculateTotalAmount(expense);
}

function createExpenseId() {
  return `expense_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeExpense(input = {}, expenseId) {
  const outfieldOnly = Boolean(input.outfieldOnly);
  const base = {
    expenseId: expenseId || input.expenseId || createExpenseId(),
    userId: input.userId || 'local-user',
    category: input.category || 'meet',
    subType: input.subType || 'concert',
    itemName: String(input.itemName || '').trim(),
    amount: toNumber(input.amount),
    quantity: toNumber(input.quantity || 1),
    date: input.date || '',
    paymentMethod: input.paymentMethod || '',
    seat: String(input.seat || '').trim(),
    location: String(input.location || '').trim(),
    remark: String(input.remark || '').trim(),
    images: normalizeImages(input.images),
    fees: normalizeFees(input.fees),
    outfieldOnly,
    includeInTotal:
      input.category === 'meet' && input.subType === 'concert'
        ? input.includeInTotal !== false
        : outfieldOnly
          ? false
          : input.includeInTotal !== false,
    collectionId: input.collectionId || '',
    stageId: input.stageId || '',
    stageDate: input.stageDate || '',
    priceTier: input.priceTier || ''
  };

  return {
    ...base,
    baseAmount: calculateBaseAmount(base),
    totalAmount: calculateTotalAmount(base),
    includedAmount: calculateIncludedAmount(base)
  };
}

function validateExpense(expense) {
  if (!expense.itemName) {
    return { valid: false, message: '请填写消费项目名称' };
  }
  if (!expense.date) {
    return { valid: false, message: '请选择消费日期' };
  }
  if (expense.images.length > 9) {
    return { valid: false, message: '图片最多上传 9 张' };
  }
  if (!expense.amount || expense.amount <= 0) {
    return { valid: false, message: '请输入大于 0 的金额' };
  }
  if (!expense.quantity || expense.quantity <= 0) {
    return { valid: false, message: '请输入大于 0 的数量' };
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

function rowToExpense(row) {
  return {
    expenseId: row.expense_id,
    userId: row.user_id,
    category: row.category,
    subType: row.sub_type,
    itemName: row.item_name,
    amount: Number(row.amount),
    quantity: Number(row.quantity),
    date: row.expense_date,
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
