const expenseService = require('./expenseService');

const MEET_BUNDLE_PREFIX = 'mb:';
const MAX_AMOUNT = 1000000;

function parseMeetBundleSource(expenseSource = '') {
  const source = String(expenseSource || '');
  if (!source.startsWith(MEET_BUNDLE_PREFIX)) {
    return null;
  }
  const parts = source.split(':');
  if (parts.length < 3) {
    return null;
  }
  return {
    bundleId: parts[1],
    role: parts[2]
  };
}
const QUICK_REMARK_TAGS = ['官票', '二级票务', '抢票', '补款', '尾款', '同行', '应援'];

function inferMeetStageType(stage) {
  const name = `${stage.stageName || ''}${stage.name || ''}`;
  if (name.indexOf('新年音乐会') >= 0) {
    return 'new_year_concert';
  }
  if (name.indexOf('运动会') >= 0) {
    return 'sports_day';
  }
  return stage.stageType || 'concert';
}

function isMeetStageType(subType) {
  return ['concert', 'new_year_concert', 'sports_day'].includes(subType);
}

function getMeetStageLabel(subType) {
  const match = expenseService.getSubType('meet', subType);
  return match ? match.name : '见面';
}

function getPositivePriceTiers(stage) {
  return (stage.priceTiers || [])
    .map((price) => Number(price))
    .filter((price) => Number.isFinite(price) && price > 0);
}

function buildHighlightedSegments(text, keyword) {
  const source = String(text || '');
  const target = String(keyword || '').trim();
  if (!source || !target) {
    return [{ text: source, matched: false }];
  }
  const lowerSource = source.toLowerCase();
  const lowerTarget = target.toLowerCase();
  const segments = [];
  let cursor = 0;
  let index = lowerSource.indexOf(lowerTarget);
  while (index >= 0) {
    if (index > cursor) {
      segments.push({ text: source.slice(cursor, index), matched: false });
    }
    segments.push({ text: source.slice(index, index + target.length), matched: true });
    cursor = index + target.length;
    index = lowerSource.indexOf(lowerTarget, cursor);
  }
  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), matched: false });
  }
  return segments.length ? segments : [{ text: source, matched: false }];
}

function getRemarkTagText(tag) {
  return `#${String(tag || '').replace(/^#/, '').trim()}`;
}

function parseRemarkParts(remark = '') {
  const source = String(remark || '');
  const tags = [];
  const text = source.replace(/#[^\s#]+/g, (match) => {
    const tag = match.replace(/^#/, '').trim();
    if (tag && !tags.includes(tag)) {
      tags.push(tag);
    }
    return ' ';
  }).replace(/\s+/g, ' ').trim();
  return { tags, text };
}

function composeRemark(tags = [], text = '') {
  const tagText = tags
    .map((tag) => getRemarkTagText(tag))
    .filter((tag) => tag !== '#')
    .join(' ');
  return [tagText, String(text || '').trim()].filter(Boolean).join(' ').trim();
}

function createDefaultFormData(overrides = {}) {
  return {
    expenseId: '',
    category: 'meet',
    subType: 'concert',
    itemName: '',
    amount: '',
    quantity: 1,
    date: '',
    paymentMethod: '微信支付',
    seat: '',
    location: '',
    city: '',
    remark: '',
    fees: {
      premium: '',
      travel: '',
      hotel: '',
      rental: '',
      other: '',
      shipping: ''
    },
    outfieldOnly: false,
    includeInTotal: true,
    collectionId: '',
    stageId: '',
    stageDate: '',
    priceTier: '',
    purchaseChannel: 'official',
    pricingMode: 'direct',
    referencePrice: '',
    unitPrice: '',
    expectedCity: '',
    expectedLocation: '',
    includeTransportCost: false,
    transportAmount: '',
    includeAccommodationCost: false,
    accommodationAmount: '',
    bundledTransportExpenseId: '',
    bundledAccommodationExpenseId: '',
    expenseSource: 'manual',
    ...overrides
  };
}

function getTodayText() {
  const date = new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function getExpenseDateEnd(formData = {}, today = getTodayText()) {
  return today;
}

function getQuickRemarkTags(remark = '') {
  const selectedTags = parseRemarkParts(remark).tags;
  return QUICK_REMARK_TAGS.map((tag) => ({
    name: tag,
    active: selectedTags.includes(tag)
  }));
}

function getFormWarnings(formData = {}) {
  const warnings = {};
  if (formData.category === 'meet' && formData.stageId) {
    const city = String(formData.city || '').trim();
    const expectedCity = String(formData.expectedCity || '').trim();
    const location = String(formData.location || '').trim();
    const expectedLocation = String(formData.expectedLocation || '').trim();
    if (expectedCity && city !== expectedCity) {
      warnings.city = '城市可能与所选云端场次不一致';
    }
    if (expectedLocation && location !== expectedLocation) {
      warnings.location = '地点可能与所选云端场次不一致';
    }
  }
  return warnings;
}

function getFormErrors(formData = {}, today = getTodayText()) {
  const errors = {};
  const amountText = String(formData.amount || '').trim();
  if (!String(formData.date || '').trim()) {
    errors.date = '请选择消费日期';
  } else if (formData.date > today) {
    errors.date = '消费日期不能晚于今天';
  }
  if (formData.category === 'meet') {
    if (!String(formData.stageDate || '').trim()) {
      errors.stageDate = '请选择见面日期';
    }
  }
  if (!String(formData.itemName || '').trim()) {
    errors.itemName = '请填写消费项目名称';
  }
  if (!amountText) {
    errors.amount = '请输入金额';
  } else if (!/^\d+(\.\d{1,2})?$/.test(amountText)) {
    errors.amount = '金额最多保留 2 位小数';
  } else if (Number(amountText) <= 0) {
    errors.amount = '金额必须大于 0';
  } else if (Number(amountText) > MAX_AMOUNT) {
    errors.amount = `金额上限为 ${MAX_AMOUNT}`;
  }
  if (formData.category === 'meet' && formData.includeTransportCost) {
    const transportAmount = String(formData.transportAmount || '').trim();
    if (!transportAmount) {
      errors.transportAmount = '请输入交通金额';
    } else if (!/^\d+(\.\d{1,2})?$/.test(transportAmount)) {
      errors.transportAmount = '交通金额最多保留 2 位小数';
    } else if (Number(transportAmount) <= 0) {
      errors.transportAmount = '交通金额必须大于 0';
    } else if (Number(transportAmount) > MAX_AMOUNT) {
      errors.transportAmount = `交通金额上限为 ${MAX_AMOUNT}`;
    }
  }
  if (formData.category === 'meet' && formData.includeAccommodationCost) {
    const accommodationAmount = String(formData.accommodationAmount || '').trim();
    if (!accommodationAmount) {
      errors.accommodationAmount = '请输入住宿金额';
    } else if (!/^\d+(\.\d{1,2})?$/.test(accommodationAmount)) {
      errors.accommodationAmount = '住宿金额最多保留 2 位小数';
    } else if (Number(accommodationAmount) <= 0) {
      errors.accommodationAmount = '住宿金额必须大于 0';
    } else if (Number(accommodationAmount) > MAX_AMOUNT) {
      errors.accommodationAmount = `住宿金额上限为 ${MAX_AMOUNT}`;
    }
  }
  return errors;
}

function getFirstValidationMessage(messages = {}) {
  const firstKey = Object.keys(messages)[0];
  return firstKey ? messages[firstKey] : '请检查填写内容';
}

async function addMeetExpenseBundle(formData) {
  const hasBundledCost = formData.includeTransportCost || formData.includeAccommodationCost;
  if (!hasBundledCost) {
    return expenseService.addExpenseAsync(formData);
  }

  const bundleId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const ticketResult = await expenseService.addExpenseAsync({
    ...formData,
    expenseSource: `${MEET_BUNDLE_PREFIX}${bundleId}:ticket`
  });
  if (!ticketResult.valid) {
    return ticketResult;
  }

  const linkedRemark = ['关联见面消费', formData.remark].filter(Boolean).join('；');
  const commonLinkedExpense = {
    date: formData.date,
    paymentMethod: formData.paymentMethod,
    city: formData.city,
    location: formData.location,
    remark: linkedRemark,
    includeInTotal: formData.includeInTotal,
    purchaseChannel: 'none',
    pricingMode: 'direct',
    stageDate: formData.stageDate,
    quantity: 1
  };

  if (formData.includeTransportCost) {
    const transportResult = await expenseService.addExpenseAsync({
      ...commonLinkedExpense,
      category: 'transport',
      subType: 'travel',
      itemName: `${formData.itemName || '见面'} 交通`,
      amount: formData.transportAmount,
      expenseSource: `${MEET_BUNDLE_PREFIX}${bundleId}:transport`
    });
    if (!transportResult.valid) {
      return transportResult;
    }
  }

  if (formData.includeAccommodationCost) {
    const accommodationResult = await expenseService.addExpenseAsync({
      ...commonLinkedExpense,
      category: 'accommodation',
      subType: 'hotel',
      itemName: `${formData.itemName || '见面'} 住宿`,
      amount: formData.accommodationAmount,
      expenseSource: `${MEET_BUNDLE_PREFIX}${bundleId}:accommodation`
    });
    if (!accommodationResult.valid) {
      return accommodationResult;
    }
  }

  return ticketResult;
}

module.exports = {
  MEET_BUNDLE_PREFIX,
  parseMeetBundleSource,
  QUICK_REMARK_TAGS,
  inferMeetStageType,
  isMeetStageType,
  getMeetStageLabel,
  getPositivePriceTiers,
  buildHighlightedSegments,
  createDefaultFormData,
  getTodayText,
  getExpenseDateEnd,
  getQuickRemarkTags,
  parseRemarkParts,
  composeRemark,
  getFormWarnings,
  getFormErrors,
  getFirstValidationMessage,
  addMeetExpenseBundle
};
