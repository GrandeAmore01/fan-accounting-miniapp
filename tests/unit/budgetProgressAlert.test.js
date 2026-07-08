const {
  saveBudget,
  getBudgetProgress,
  validateBudget
} = require('../../services/budgetService');

const {
  addExpense
} = require('../../services/expenseService');

function createBudget(overrides = {}) {
  return {
    budgetType: 'month',
    period: '2026-07',
    amount: 6000,
    threshold: 0.8,
    categoryBudgets: {},
    ...overrides
  };
}

function createExpense(overrides = {}) {
  return {
    expenseId: 'expense-budget-progress-001',
    category: 'goods',
    subType: 'photo_card',
    itemName: '预算状态测试消费',
    amount: 1000,
    quantity: 1,
    date: '2026-07-10',
    paymentMethod: '微信支付',
    images: [],
    fees: {},
    includeInTotal: true,
    ...overrides
  };
}

beforeEach(() => {
  wx.clearStorageSync();
});

describe('总预算进度与状态黑盒测试', () => {
  test('TC-BUD-PROG-001：消费 3000 预算 6000 时使用率应为 50%', () => {
    saveBudget(createBudget());

    addExpense(
      createExpense({
        amount: 3000
      })
    );

    const progress = getBudgetProgress(
      'month',
      '2026-07'
    );

    expect(progress.totalAmount).toBe(3000);
    expect(progress.remainingAmount).toBe(3000);
    expect(progress.usedRate).toBe(0.5);
    expect(progress.isOverThreshold).toBe(false);
    expect(progress.isOverBudget).toBe(false);
  });

  test('TC-BUD-PROG-002：消费达到 80% 阈值时应进入预警条件', () => {
    saveBudget(createBudget());

    addExpense(
      createExpense({
        amount: 4800
      })
    );

    const progress = getBudgetProgress(
      'month',
      '2026-07'
    );

    expect(progress.usedRate).toBe(0.8);
    expect(progress.isOverThreshold).toBe(true);
    expect(progress.isOverBudget).toBe(false);
  });

  test('TC-BUD-PROG-003：消费低于 80% 阈值时不应触发预算预警', () => {
    saveBudget(createBudget());

    addExpense(
      createExpense({
        amount: 4799
      })
    );

    const progress = getBudgetProgress(
      'month',
      '2026-07'
    );

    expect(progress.usedRate).toBeLessThan(0.8);
    expect(progress.isOverThreshold).toBe(false);
    expect(progress.isOverBudget).toBe(false);
  });

  test('TC-BUD-PROG-004：消费等于预算时使用率应为 100%', () => {
    saveBudget(createBudget());

    addExpense(
      createExpense({
        amount: 6000
      })
    );

    const progress = getBudgetProgress(
      'month',
      '2026-07'
    );

    expect(progress.totalAmount).toBe(6000);
    expect(progress.remainingAmount).toBe(0);
    expect(progress.usedRate).toBe(1);
    expect(progress.isOverThreshold).toBe(true);
    expect(progress.isOverBudget).toBe(false);
  });

  test('TC-BUD-PROG-005：消费超过预算时应标记为超支', () => {
    saveBudget(createBudget());

    addExpense(
      createExpense({
        amount: 7000
      })
    );

    const progress = getBudgetProgress(
      'month',
      '2026-07'
    );

    expect(progress.totalAmount).toBe(7000);
    expect(progress.remainingAmount).toBe(0);
    expect(progress.usedRate).toBeGreaterThan(1);
    expect(progress.isOverThreshold).toBe(true);
    expect(progress.isOverBudget).toBe(true);
  });

  test('TC-BUD-PROG-006：未设置预算时应保持未设置数据状态', () => {
    const progress = getBudgetProgress(
      'month',
      '2026-07'
    );

    expect(progress.budget.amount).toBe(0);
    expect(progress.totalAmount).toBe(0);
    expect(progress.remainingAmount).toBe(0);
    expect(progress.usedRate).toBe(0);
    expect(progress.isOverThreshold).toBe(false);
    expect(progress.isOverBudget).toBe(false);
  });
});

describe('分类预算校验黑盒测试', () => {
  test('TC-BUD-CAT-001：分类预算总和小于总预算时应允许保存', () => {
    const result = validateBudget(
      createBudget({
        categoryBudgets: {
          meet_concert: 3000,
          album: 1000,
          goods: 500
        }
      })
    );

    expect(result.valid).toBe(true);
  });

  test('TC-BUD-CAT-002：分类预算总和等于总预算时应允许保存', () => {
    const result = validateBudget(
      createBudget({
        categoryBudgets: {
          meet_concert: 3000,
          album: 2000,
          goods: 1000
        }
      })
    );

    expect(result.valid).toBe(true);
  });

  test('TC-BUD-CAT-003：分类预算总和超过总预算时应拒绝保存', () => {
    const result = validateBudget(
      createBudget({
        amount: 5000,
        categoryBudgets: {
          meet_concert: 3000,
          album: 2000,
          goods: 1000
        }
      })
    );

    expect(result.valid).toBe(false);
    expect(result.message).toBe(
      '分类预算总额不能超过总预算'
    );
  });

  test('TC-BUD-CAT-004：分类预算为负数时应拒绝保存', () => {
    const result = validateBudget(
      createBudget({
        categoryBudgets: {
          goods: -100
        }
      })
    );

    expect(result.valid).toBe(false);
    expect(result.message).toBe(
      '分类预算不能小于 0'
    );
  });

  test('TC-BUD-CAT-005：分类预算为空对象时应允许保存总预算', () => {
    const result = validateBudget(
      createBudget({
        categoryBudgets: {}
      })
    );

    expect(result.valid).toBe(true);
  });
});