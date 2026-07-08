const {
  validateBudget
} = require('../../services/budgetService');

describe('预算金额黑盒测试', () => {
  test('TC-BUD-001：预算金额为空时应拒绝保存', () => {
    const result = validateBudget({
      budgetType: 'month',
      period: '2026-07',
      amount: '',
      threshold: 0.8
    });

    expect(result.valid).toBe(false);
  });

  test('TC-BUD-002：预算金额为 0 时应拒绝保存', () => {
    const result = validateBudget({
      budgetType: 'month',
      period: '2026-07',
      amount: 0,
      threshold: 0.8
    });

    expect(result.valid).toBe(false);
  });

  test('TC-BUD-003：预算金额为负数时应拒绝保存', () => {
    const result = validateBudget({
      budgetType: 'month',
      period: '2026-07',
      amount: -1,
      threshold: 0.8
    });

    expect(result.valid).toBe(false);
  });

  test('TC-BUD-004：预算金额为 6000 时应正常通过', () => {
    const result = validateBudget({
      budgetType: 'month',
      period: '2026-07',
      amount: 6000,
      threshold: 0.8
    });

    expect(result.valid).toBe(true);
  });
});

describe('预算提醒阈值边界值测试', () => {
  test('TC-BUD-005：阈值为空时应使用默认 80%', () => {
    const result = validateBudget({
      budgetType: 'month',
      period: '2026-07',
      amount: 6000,
      threshold: ''
    });

    expect(result.valid).toBe(true);
    expect(result.data.threshold).toBe(0.8);
  });

  test('TC-BUD-007：阈值为 0 时应拒绝保存', () => {
    const result = validateBudget({
      budgetType: 'month',
      period: '2026-07',
      amount: 6000,
      threshold: 0
    });

    expect(result.valid).toBe(false);
    expect(result.message).toBe('提醒阈值需在 1% 到 100% 之间');
  });

  test('TC-BUD-008：阈值为 1% 时应正常通过', () => {
    const result = validateBudget({
      budgetType: 'month',
      period: '2026-07',
      amount: 6000,
      threshold: 0.01
    });

    expect(result.valid).toBe(true);
    expect(result.data.threshold).toBe(0.01);
  });

  test('TC-BUD-009：阈值为 80% 时应正常通过', () => {
    const result = validateBudget({
      budgetType: 'month',
      period: '2026-07',
      amount: 6000,
      threshold: 0.8
    });

    expect(result.valid).toBe(true);
    expect(result.data.threshold).toBe(0.8);
  });

  test('TC-BUD-010：阈值为 100% 时应正常通过', () => {
    const result = validateBudget({
      budgetType: 'month',
      period: '2026-07',
      amount: 6000,
      threshold: 1
    });

    expect(result.valid).toBe(true);
    expect(result.data.threshold).toBe(1);
  });

  test('TC-BUD-011：阈值超过 100% 时应拒绝保存', () => {
    const result = validateBudget({
      budgetType: 'month',
      period: '2026-07',
      amount: 6000,
      threshold: 1.2
    });

    expect(result.valid).toBe(false);
  });
});

describe('预算周期黑盒测试', () => {
  test('TC-BUD-012：月度预算周期应正常通过', () => {
    const result = validateBudget({
      budgetType: 'month',
      period: '2026-07',
      amount: 6000,
      threshold: 0.8
    });

    expect(result.valid).toBe(true);
  });

  test('TC-BUD-013：年度预算周期应正常通过', () => {
    const result = validateBudget({
      budgetType: 'year',
      period: '2026',
      amount: 50000,
      threshold: 0.8
    });

    expect(result.valid).toBe(true);
  });

  test('TC-BUD-014：年度预算年份不足四位时应拒绝', () => {
    const result = validateBudget({
      budgetType: 'year',
      period: '20',
      amount: 50000,
      threshold: 0.8
    });

    expect(result.valid).toBe(false);
  });
});