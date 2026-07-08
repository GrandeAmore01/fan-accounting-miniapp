const {
  addExpense,
  updateExpense,
  removeExpense
} = require('../../services/expenseService');

const {
  saveBudget,
  getBudgetProgress
} = require('../../services/budgetService');

function createExpense(overrides = {}) {
  return {
    expenseId: 'expense-budget-001',
    category: 'goods',
    subType: 'photo_card',
    itemName: '预算联动测试消费',
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

function createMonthlyBudget(overrides = {}) {
  return {
    budgetType: 'month',
    period: '2026-07',
    amount: 6000,
    threshold: 0.8,
    ...overrides
  };
}

beforeEach(() => {
  wx.clearStorageSync();
});

describe('消费与月度预算联动集成测试', () => {
  test('TC-INT-EXP-BUD-001：新增计入总消费的记录后预算已用金额应增加', () => {
    saveBudget(createMonthlyBudget());

    addExpense(
      createExpense({
        amount: 1000,
        includeInTotal: true
      })
    );

    const progress = getBudgetProgress(
      'month',
      '2026-07'
    );

    expect(progress.totalAmount).toBe(1000);
    expect(progress.remainingAmount).toBe(5000);
  });

  test('TC-INT-EXP-BUD-002：不计入总消费的记录不应进入预算统计', () => {
    saveBudget(createMonthlyBudget());

    addExpense(
      createExpense({
        amount: 1000,
        includeInTotal: false
      })
    );

    const progress = getBudgetProgress(
      'month',
      '2026-07'
    );

    expect(progress.totalAmount).toBe(0);
    expect(progress.remainingAmount).toBe(6000);
  });

  test('TC-INT-EXP-BUD-003：其他月份消费不应进入当前月预算', () => {
    saveBudget(createMonthlyBudget());

    addExpense(
      createExpense({
        date: '2026-08-10',
        amount: 1000
      })
    );

    const progress = getBudgetProgress(
      'month',
      '2026-07'
    );

    expect(progress.totalAmount).toBe(0);
    expect(progress.remainingAmount).toBe(6000);
  });

  test('TC-INT-EXP-BUD-004：编辑消费金额后预算已用金额应同步变化', () => {
    saveBudget(createMonthlyBudget());

    addExpense(
      createExpense({
        amount: 1000
      })
    );

    updateExpense(
      'expense-budget-001',
      createExpense({
        amount: 2000
      })
    );

    const progress = getBudgetProgress(
      'month',
      '2026-07'
    );

    expect(progress.totalAmount).toBe(2000);
    expect(progress.remainingAmount).toBe(4000);
  });

  test('TC-INT-EXP-BUD-005：删除消费后预算已用金额应减少', () => {
    saveBudget(createMonthlyBudget());

    addExpense(
      createExpense({
        amount: 1000
      })
    );

    removeExpense('expense-budget-001');

    const progress = getBudgetProgress(
      'month',
      '2026-07'
    );

    expect(progress.totalAmount).toBe(0);
    expect(progress.remainingAmount).toBe(6000);
  });

  test('TC-INT-EXP-BUD-006：多笔同月消费应累计进入预算已用金额', () => {
    saveBudget(createMonthlyBudget());

    addExpense(
      createExpense({
        expenseId: 'expense-budget-001',
        amount: 1000
      })
    );

    addExpense(
      createExpense({
        expenseId: 'expense-budget-002',
        itemName: '第二笔预算消费',
        amount: 500
      })
    );

    const progress = getBudgetProgress(
      'month',
      '2026-07'
    );

    expect(progress.totalAmount).toBe(1500);
    expect(progress.remainingAmount).toBe(4500);
  });
});

describe('消费与年度预算联动集成测试', () => {
  test('TC-INT-EXP-BUD-007：年度预算应累计同一年不同月份消费', () => {
    const yearlyBudget = {
      budgetType: 'year',
      period: '2026',
      amount: 50000,
      threshold: 0.8
    };

    saveBudget(yearlyBudget);

    addExpense(
      createExpense({
        expenseId: 'expense-year-001',
        date: '2026-01-15',
        amount: 1000
      })
    );

    addExpense(
      createExpense({
        expenseId: 'expense-year-002',
        date: '2026-07-15',
        amount: 2000
      })
    );

    addExpense(
      createExpense({
        expenseId: 'expense-year-003',
        date: '2026-12-15',
        amount: 3000
      })
    );

    const progress = getBudgetProgress(
      'year',
      '2026'
    );

    expect(progress.totalAmount).toBe(6000);
    expect(progress.remainingAmount).toBe(44000);
  });

  test('TC-INT-EXP-BUD-008：其他年份消费不应进入 2026 年度预算', () => {
    const yearlyBudget = {
      budgetType: 'year',
      period: '2026',
      amount: 50000,
      threshold: 0.8
    };

    saveBudget(yearlyBudget);

    addExpense(
      createExpense({
        expenseId: 'expense-year-2025',
        date: '2025-12-31',
        amount: 5000
      })
    );

    addExpense(
      createExpense({
        expenseId: 'expense-year-2026',
        date: '2026-01-01',
        amount: 1000
      })
    );

    const progress = getBudgetProgress(
      'year',
      '2026'
    );

    expect(progress.totalAmount).toBe(1000);
    expect(progress.remainingAmount).toBe(49000);
  });
});