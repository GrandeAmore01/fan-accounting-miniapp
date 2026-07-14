const expenseService = require('./expenseService');
const storageService = require('./storageService');
const config = require('./config');
const apiService = require('./apiService');

const USER_ID = config.userId || 'local-user';
const DEFAULT_THRESHOLD = 0.8;
const BUDGET_TARGETS = [
  { id: 'meet', name: '见面' },
  { id: 'collection', name: '藏品' },
  { id: 'transport', name: '交通' },
  { id: 'accommodation', name: '住宿' },
  { id: 'other', name: '其他' }
];
const LEGACY_CATEGORY_MAP = {
  album: 'collection',
  goods: 'collection',
  magazine: 'collection',
  card: 'collection',
  endorsement: 'collection',
  business: 'collection',
  traffic: 'transport',
  ticket: 'meet',
  support: 'meet',
  other_collection: 'collection'
};

function getBudgetTargets() {
  return BUDGET_TARGETS.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.id,
    subType: ''
  }));
}

function getBudgetTarget(targetId) {
  return BUDGET_TARGETS.find((item) => item.id === targetId) || BUDGET_TARGETS[BUDGET_TARGETS.length - 1];
}

function normalizeBudgetCategory(category) {
  if (BUDGET_TARGETS.some((item) => item.id === category)) {
    return category;
  }
  return LEGACY_CATEGORY_MAP[category] || 'other';
}

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

function getPreviousPeriod(budgetType, period) {
  if (budgetType === 'year') {
    return `${Number(period || getCurrentYear()) - 1}`;
  }
  const [year, month] = (period || getCurrentMonth()).split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  const nextMonth = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${date.getFullYear()}-${nextMonth}`;
}

function getRecentPeriods(budgetType, currentPeriod, limit = 6) {
  const periods = [];
  let cursor = currentPeriod || getDefaultPeriod(budgetType);
  for (let index = 0; index < limit; index += 1) {
    periods.unshift(cursor);
    cursor = getPreviousPeriod(budgetType, cursor);
  }
  return periods;
}

function normalizeBudget(budget) {
  const budgetType = budget.budgetType === 'year' ? 'year' : 'month';
  const period = budget.period || getDefaultPeriod(budgetType);
  return {
    budgetId: budget.budgetId || `budget_${budgetType}_${period}`,
    budgetType,
    amount: Number(budget.amount || 0),
    period,
    threshold: typeof budget.threshold === 'number' ? Number(budget.threshold) : DEFAULT_THRESHOLD,
    categoryBudgets: normalizeCategoryBudgets(budget.categoryBudgets)
  };
}

function normalizeCategoryBudgets(categoryBudgets = {}) {
  const result = getBudgetTargets().reduce((map, target) => {
    map[target.id] = 0;
    return map;
  }, {});
  Object.keys(categoryBudgets || {}).forEach((key) => {
    const targetId = key.indexOf('meet_') === 0 ? 'meet' : normalizeBudgetCategory(key);
    result[targetId] += Number(categoryBudgets[key] || 0);
  });
  Object.keys(result).forEach((key) => {
    result[key] = result[key] > 0 ? result[key] : 0;
  });
  return result;
}

function validateBudget(budget) {
  const nextBudget = normalizeBudget(budget);
  if (!nextBudget.amount || nextBudget.amount <= 0) {
    return { valid: false, message: '请输入大于 0 的预算金额' };
  }
  if (nextBudget.threshold <= 0 || nextBudget.threshold > 1) {
    return { valid: false, message: '提醒阈值需在 1% 到 100% 之间' };
  }
  const hasInvalidCategoryBudget = Object.keys(nextBudget.categoryBudgets).some(
    (key) => nextBudget.categoryBudgets[key] < 0
  );
  if (hasInvalidCategoryBudget) {
    return { valid: false, message: '分类预算不能小于 0' };
  }
  const categoryBudgetTotal = Object.keys(nextBudget.categoryBudgets).reduce(
    (sum, key) => sum + Number(nextBudget.categoryBudgets[key] || 0),
    0
  );
  if (categoryBudgetTotal > nextBudget.amount) {
    return { valid: false, message: '分类预算总额不能超过总预算' };
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
  const savedBudget = budgets.find((item) => item.budgetType === targetType && item.period === targetPeriod);
  return normalizeBudget(
    savedBudget || {
    budgetId: `budget_${targetType}_${targetPeriod}`,
    budgetType: targetType,
    amount: 0,
    threshold: DEFAULT_THRESHOLD,
    period: targetPeriod,
    categoryBudgets: normalizeCategoryBudgets()
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

async function saveBudgetAsync(budget) {
  const validation = validateBudget(budget);
  if (!validation.valid) {
    return validation;
  }
  try {
    const saved = await apiService.request({
      url: '/budgets',
      method: 'PUT',
      data: validation.data
    });
    return saveBudget(saved || validation.data);
  } catch (error) {
    return { valid: false, message: error.message || '预算保存失败' };
  }
}

async function loadBudgetsFromCloud() {
  const localBudgets = storageService.getCollection(USER_ID, 'budgets');
  const cloudBudgets = await apiService.request({ url: '/budgets' });

  // 首次启用云端预算时，将当前设备已有预算归入当前微信用户。
  if ((!cloudBudgets || cloudBudgets.length === 0) && localBudgets.length > 0) {
    const migrated = [];
    for (const budget of localBudgets) {
      const validation = validateBudget(budget);
      if (validation.valid) {
        const saved = await apiService.request({
          url: '/budgets',
          method: 'PUT',
          data: validation.data
        });
        migrated.push(normalizeBudget(saved || validation.data));
      }
    }
    storageService.setCollection(USER_ID, 'budgets', migrated);
    return migrated;
  }

  const normalized = (cloudBudgets || []).map(normalizeBudget);
  storageService.setCollection(USER_ID, 'budgets', normalized);
  return normalized;
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

function getPeriodTotalAmount(budgetType = 'month', period = getDefaultPeriod(budgetType)) {
  return getPeriodExpenses(budgetType, period).reduce(
    (sum, item) => sum + Number(item.includedAmount || 0),
    0
  );
}

function getBudgetProgress(budgetType = 'month', period = getDefaultPeriod(budgetType)) {
  const budget = getBudget(budgetType, period);
  const periodExpenses = getPeriodExpenses(budget.budgetType, budget.period);
  const totalAmount = periodExpenses.reduce((sum, item) => sum + Number(item.includedAmount || 0), 0);
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
  const totalAmount = periodExpenses.reduce((sum, item) => sum + Number(item.includedAmount || 0), 0);
  const map = {};
  periodExpenses.forEach((item) => {
    const targetId = normalizeBudgetCategory(item.category);
    const target = getBudgetTarget(targetId);
    if (!map[targetId]) {
      map[targetId] = {
        category: targetId,
        categoryName: target.name,
        amount: 0,
        count: 0
      };
    }
    map[targetId].amount += Number(item.includedAmount || 0);
    map[targetId].count += 1;
  });
  return Object.keys(map)
    .map((key) => ({
      ...map[key],
      percent: totalAmount > 0 ? Math.round((map[key].amount / totalAmount) * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount);
}

function getCategoryBudgetStats(budgetType = 'month', period = getDefaultPeriod(budgetType)) {
  const budget = getBudget(budgetType, period);
  const periodExpenses = getPeriodExpenses(budgetType, period);
  const expenseMap = {};

  periodExpenses.forEach((item) => {
    const targetId = normalizeBudgetCategory(item.category);
    expenseMap[targetId] = expenseMap[targetId] || {
      amount: 0,
      count: 0
    };
    expenseMap[targetId].amount += Number(item.includedAmount || 0);
    expenseMap[targetId].count += 1;
  });

  return getBudgetTargets().map((target) => {
    const usedAmount = expenseMap[target.id] ? expenseMap[target.id].amount : 0;
    const budgetAmount = Number((budget.categoryBudgets || {})[target.id] || 0);
    const usedRate = budgetAmount > 0 ? usedAmount / budgetAmount : 0;
    return {
      category: target.id,
      categoryName: target.name,
      budgetAmount,
      usedAmount,
      remainingAmount: budgetAmount > 0 ? Math.max(budgetAmount - usedAmount, 0) : 0,
      count: expenseMap[target.id] ? expenseMap[target.id].count : 0,
      percent: budgetAmount > 0 ? Math.min(Math.round(usedRate * 100), 999) : 0,
      isOverBudget: budgetAmount > 0 && usedRate > 1,
      isUnset: budgetAmount <= 0
    };
  });
}

function getBudgetComparison(budgetType = 'month', period = getDefaultPeriod(budgetType)) {
  const currentAmount = getPeriodTotalAmount(budgetType, period);
  const previousPeriod = getPreviousPeriod(budgetType, period);
  const previousAmount = getPeriodTotalAmount(budgetType, previousPeriod);
  const diffAmount = currentAmount - previousAmount;
  const diffPercent = previousAmount > 0 ? Math.round((diffAmount / previousAmount) * 100) : 0;
  return {
    currentAmount,
    previousPeriod,
    previousAmount,
    diffAmount,
    diffPercent,
    trend: diffAmount > 0 ? 'up' : diffAmount < 0 ? 'down' : 'flat'
  };
}

function getBudgetWarnings(budgetType = 'month', period = getDefaultPeriod(budgetType)) {
  const progress = getBudgetProgress(budgetType, period);
  const warnings = [];

  if (progress.budget.amount > 0 && progress.isOverBudget) {
    warnings.push({
      id: `${budgetType}_${period}_total_100`,
      level: 'danger',
      title: '总预算已超支',
      desc: `当前周期预算使用率 ${progress.percent}%，已超过总预算。`,
      period
    });
  } else if (progress.budget.amount > 0 && progress.isOverThreshold) {
    warnings.push({
      id: `${budgetType}_${period}_total_80`,
      level: 'warn',
      title: '总预算达到提醒线',
      desc: `当前周期预算使用率 ${progress.percent}%，已达到 ${progress.thresholdPercent}% 提醒阈值。`,
      period
    });
  }

  getCategoryBudgetStats(budgetType, period).forEach((item) => {
    if (item.isUnset) {
      return;
    }
    if (item.isOverBudget) {
      warnings.push({
        id: `${budgetType}_${period}_${item.category}_100`,
        level: 'danger',
        title: `${item.categoryName}分类预算已超支`,
        desc: `${item.categoryName}已使用 ${item.percent}%，超过分类预算。`,
        period
      });
    } else if (item.percent >= 80) {
      warnings.push({
        id: `${budgetType}_${period}_${item.category}_80`,
        level: 'warn',
        title: `${item.categoryName}分类预算接近上限`,
        desc: `${item.categoryName}已使用 ${item.percent}%，建议控制后续支出。`,
        period
      });
    }
  });

  return warnings;
}

function getBudgetHistory(budgetType = 'month', period = getDefaultPeriod(budgetType), limit = 6) {
  const budgets = storageService.getCollection(USER_ID, 'budgets');
  const expenses = expenseService.listExpenses().filter((item) => item.includeInTotal !== false && item.date);
  const periodSet = new Set(getRecentPeriods(budgetType, period, limit));
  periodSet.add(period || getDefaultPeriod(budgetType));
  budgets
    .filter((item) => item.budgetType === budgetType)
    .forEach((item) => periodSet.add(item.period));
  expenses.forEach((item) => {
    periodSet.add(budgetType === 'year' ? item.date.slice(0, 4) : item.date.slice(0, 7));
  });
  const periods = Array.from(periodSet)
    .filter(Boolean)
    .sort()
    .slice(-12);
  return periods.map((itemPeriod) => {
    const budget = getBudget(budgetType, itemPeriod);
    const actualAmount = getPeriodTotalAmount(budgetType, itemPeriod);
    const usedRate = budget.amount > 0 ? actualAmount / budget.amount : 0;
    return {
      period: itemPeriod,
      budgetAmount: budget.amount,
      actualAmount,
      remainingAmount: budget.amount > 0 ? Math.max(budget.amount - actualAmount, 0) : 0,
      percent: budget.amount > 0 ? Math.min(Math.round(usedRate * 100), 999) : 0,
      hasBudget: budget.amount > 0,
      isOverBudget: budget.amount > 0 && usedRate > 1
    };
  }).reverse();
}

function getBudgetInsight(budgetType = 'month', period = getDefaultPeriod(budgetType)) {
  const progress = getBudgetProgress(budgetType, period);
  const categoryStats = getCategoryStats(budgetType, period);
  const categoryBudgetStats = getCategoryBudgetStats(budgetType, period);
  const history = getBudgetHistory(budgetType, period, 4);
  const historyWithActual = history.filter((item) => item.actualAmount > 0);
  const averageActual =
    historyWithActual.length > 0
      ? historyWithActual.reduce((sum, item) => sum + item.actualAmount, 0) / historyWithActual.length
      : 0;
  const currentAmount = Number(progress.totalAmount || 0);
  const currentBudget = Number(progress.budget.amount || 0);
  const remainingAmount = Math.max(0, currentBudget - currentAmount);
  const periodName = budgetType === 'year' ? '下一年度' : '下月';
  const historyBase = averageActual > 0 ? averageActual * 1.1 : 0;
  let currentBase = currentAmount > 0 ? currentAmount * 1.05 : 0;
  if (progress.isOverBudget) {
    currentBase = currentAmount * 1.1;
  } else if (progress.isOverThreshold) {
    currentBase = currentAmount * 1.08;
  }
  const suggestedBase = Math.max(historyBase, currentBase);
  const suggestedBudget = suggestedBase > 0 ? Math.ceil(suggestedBase / 10) * 10 : 0;
  const topCategory = categoryStats[0];
  const riskCategories = categoryBudgetStats
    .filter((item) => !item.isUnset && item.percent > 0)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3);
  const overBudgetCategories = categoryBudgetStats.filter((item) => !item.isUnset && item.isOverBudget);
  const nearLimitCategories = categoryBudgetStats.filter(
    (item) => !item.isUnset && !item.isOverBudget && item.percent >= 80
  );
  const maxCategoryPercent = categoryBudgetStats.reduce(
    (max, item) => Math.max(max, item.isUnset ? 0 : item.percent),
    0
  );
  const unsetCategoryHints = categoryBudgetStats
    .filter((item) => item.isUnset && item.usedAmount > 0)
    .map((item) => ({
      category: item.category,
      categoryName: item.categoryName,
      usedAmount: item.usedAmount
    }));

  let score = 100;
  if (!progress.budget.amount) {
    score = 60;
  } else if (progress.isOverBudget) {
    score = progress.percent >= 150 ? 25 : Math.max(35, 60 - (progress.percent - 100));
  } else if (progress.isOverThreshold) {
    score = 75;
  } else if (progress.percent < 50) {
    score = 95;
  } else {
    score = 88;
  }
  if (overBudgetCategories.length > 0) {
    score = Math.min(score, maxCategoryPercent >= 200 ? 45 : 65);
    score -= Math.min(overBudgetCategories.length * 8, 24);
  }
  if (nearLimitCategories.length > 0) {
    score -= Math.min(nearLimitCategories.length * 4, 12);
  }
  if (topCategory && topCategory.percent >= 70) {
    score -= 6;
  }
  score = Math.max(20, Math.round(score));

  const level =
    score >= 90 ? '优秀' : score >= 80 ? '良好' : score >= 60 ? '需关注' : '风险';
  let mainReason = '本期暂无主要消费分类。';
  if (overBudgetCategories.length) {
    mainReason = `${overBudgetCategories.length} 个分类预算已超支，最高为${overBudgetCategories[0].categoryName} ${overBudgetCategories[0].percent}%。`;
  } else if (topCategory && progress.isOverBudget) {
    mainReason = `本期已经超出总预算，主要支出来自${topCategory.categoryName}，占比 ${topCategory.percent}%。`;
  } else if (topCategory) {
    mainReason = `本期主要支出来自${topCategory.categoryName}，占比 ${topCategory.percent}%。`;
  }
  let suggestion = '暂无足够历史数据，建议先完成 1-2 个周期记录后再参考预算建议。';
  if (!currentBudget && suggestedBudget > 0) {
    suggestion = `当前还未设置总预算，可先按本期已记录消费和历史均值，将${periodName}预算设为 ￥${suggestedBudget.toFixed(2)} 左右。`;
  } else if (progress.isOverBudget && suggestedBudget > 0) {
    suggestion = `本期已用 ￥${currentAmount.toFixed(2)}，已经超过当前预算，${periodName}预算建议至少参考 ￥${suggestedBudget.toFixed(2)}，同时先减少高风险分类支出。`;
  } else if (progress.isOverThreshold && suggestedBudget > 0) {
    suggestion = `本期已使用 ${progress.percent}%，剩余预算约 ￥${remainingAmount.toFixed(2)}，建议先控制新增支出；${periodName}预算可参考 ￥${suggestedBudget.toFixed(2)}。`;
  } else if (currentBudget && suggestedBudget > 0) {
    suggestion = `当前剩余预算约 ￥${remainingAmount.toFixed(2)}，预算压力相对可控，建议继续按五大类记录；${periodName}预算可参考 ￥${suggestedBudget.toFixed(2)}。`;
  } else if (currentBudget) {
    suggestion = `当前周期还没有明显消费数据，建议先保持 ￥${currentBudget.toFixed(2)} 的预算设置，并继续记录后再调整${periodName}预算。`;
  }
  let overspendReason = '分类预算暂未出现明显异常，可继续观察消费节奏。';
  if (overBudgetCategories.length) {
    overspendReason = `优先处理${overBudgetCategories
      .map((item) => `${item.categoryName}${item.percent}%`)
      .slice(0, 3)
      .join('、')}等超支分类，避免总预算继续被拉高。`;
  } else if (progress.isOverBudget && topCategory) {
    overspendReason = `当前总预算使用率为 ${progress.percent}%，已超过 100%，建议先压缩${topCategory.categoryName}相关支出。`;
  } else if (progress.isOverThreshold && riskCategories.length) {
    overspendReason = `当前已接近预算上限，建议重点关注${riskCategories
      .map((item) => item.categoryName)
      .slice(0, 2)
      .join('、')}的后续支出。`;
  } else if (unsetCategoryHints.length) {
    overspendReason = `${unsetCategoryHints
      .map((item) => item.categoryName)
      .slice(0, 2)
      .join('、')}已有支出但未设置分类预算，建议补充分项预算便于预警。`;
  }

  return {
    score: Math.round(score),
    level,
    mainReason,
    suggestion,
    overspendReason,
    riskCategories,
    unsetCategoryHints
  };
}

function getMonthTrend(period = getCurrentMonth(), limit = 12) {
  const expenses = expenseService.listExpenses().filter((item) => item.includeInTotal !== false && item.date);
  const budgets = storageService.getCollection(USER_ID, 'budgets');
  const map = {};
  const monthSet = new Set();

  if (period && period.length >= 7) {
    monthSet.add(period.slice(0, 7));
  }

  expenses.forEach((item) => {
    const month = item.date.slice(0, 7);
    map[month] = (map[month] || 0) + Number(item.includedAmount || 0);
    monthSet.add(month);
  });

  budgets.forEach((item) => {
    if (item.budgetType === 'month' && item.period) {
      monthSet.add(item.period.slice(0, 7));
      map[item.period.slice(0, 7)] = map[item.period.slice(0, 7)] || 0;
    }
  });

  const months = Array.from(monthSet).filter(Boolean).sort().slice(-limit);
  const maxAmount = Math.max(...months.map((month) => map[month]), 0);
  return months.map((month) => ({
    month,
    amount: map[month] || 0,
    percent: maxAmount > 0 ? Math.round((map[month] / maxAmount) * 100) : 0
  }));
}

function getBudgetDashboard(budgetType = 'month', period = getDefaultPeriod(budgetType)) {
  return {
    progress: getBudgetProgress(budgetType, period),
    categoryStats: getCategoryStats(budgetType, period),
    categoryBudgetStats: getCategoryBudgetStats(budgetType, period),
    comparison: getBudgetComparison(budgetType, period),
    warnings: getBudgetWarnings(budgetType, period),
    budgetHistory: getBudgetHistory(budgetType, period),
    insight: getBudgetInsight(budgetType, period),
    monthTrend: getMonthTrend(period)
  };
}

async function getBudgetDashboardAsync(budgetType = 'month', period = getDefaultPeriod(budgetType)) {
  await Promise.all([
    expenseService.listExpensesAsync(),
    loadBudgetsFromCloud()
  ]);
  return getBudgetDashboard(budgetType, period);
}

module.exports = {
  expenseCategories: expenseService.expenseCategories,
  getBudgetTargets,
  getCurrentMonth,
  getCurrentYear,
  getDefaultPeriod,
  getBudget,
  saveBudget,
  saveBudgetAsync,
  loadBudgetsFromCloud,
  validateBudget,
  getPeriodExpenses,
  getBudgetProgress,
  getCategoryStats,
  getCategoryBudgetStats,
  getBudgetComparison,
  getBudgetWarnings,
  getBudgetHistory,
  getBudgetInsight,
  getMonthTrend,
  getBudgetDashboard,
  getBudgetDashboardAsync
};
