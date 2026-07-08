const {
  validateExpense,
  calculateTotalAmount,
  calculateIncludedAmount
} = require('../../services/expenseService');

function createValidExpense(overrides = {}) {
  return {
    category: 'goods',
    subType: 'photo_card',
    itemName: '测试藏品',
    amount: 100,
    quantity: 1,
    date: '2026-07-07',
    paymentMethod: '微信支付',
    includeInTotal: true,
    images: [],
    fees: {},
    ...overrides
  };
}

describe('消费金额边界值测试', () => {
  test('TC-EXP-001：金额为空时应拒绝保存', () => {
    const result = validateExpense(
      createValidExpense({
        amount: ''
      })
    );

    expect(result.valid).toBe(false);
  });

  test('TC-EXP-002：金额为 0 时应拒绝保存', () => {
    const result = validateExpense(
      createValidExpense({
        amount: 0
      })
    );

    expect(result.valid).toBe(false);
  });

  test('TC-EXP-003：金额为负数时应拒绝保存', () => {
    const result = validateExpense(
      createValidExpense({
        amount: -1
      })
    );

    expect(result.valid).toBe(false);
  });

  test('TC-EXP-004：金额为 0.01 时应正常通过', () => {
    const result = validateExpense(
      createValidExpense({
        amount: 0.01
      })
    );

    expect(result.valid).toBe(true);
  });

  test('TC-EXP-005：金额为 999999.99 时应正常通过', () => {
    const result = validateExpense(
      createValidExpense({
        amount: 999999.99
      })
    );

    expect(result.valid).toBe(true);
  });

  test('TC-EXP-006：金额达到 1000000 时应拒绝保存', () => {
    const result = validateExpense(
      createValidExpense({
        amount: 1000000
      })
    );

    expect(result.valid).toBe(false);
  });

  test('TC-EXP-007：金额超过两位小数时应拒绝保存', () => {
    const result = validateExpense(
      createValidExpense({
        amount: 12.345
      })
    );

    expect(result.valid).toBe(false);
  });

  test('TC-EXP-008：金额包含非法字符时应拒绝保存', () => {
    const result = validateExpense(
      createValidExpense({
        amount: 'abc'
      })
    );

    expect(result.valid).toBe(false);
  });

  test('TC-EXP-009：金额包含多个小数点时应拒绝保存', () => {
    const result = validateExpense(
      createValidExpense({
        amount: '1..2'
      })
    );

    expect(result.valid).toBe(false);
  });
});

describe('藏品数量边界值测试', () => {
  test('TC-EXP-010：数量为 0 时应拒绝保存', () => {
    const result = validateExpense(
      createValidExpense({
        quantity: 0
      })
    );

    expect(result.valid).toBe(false);
  });

  test('TC-EXP-011：数量为 1 时应正常通过', () => {
    const result = validateExpense(
      createValidExpense({
        quantity: 1
      })
    );

    expect(result.valid).toBe(true);
  });

  test('TC-EXP-012：数量为 10 时应正常通过', () => {
    const result = validateExpense(
      createValidExpense({
        quantity: 10
      })
    );

    expect(result.valid).toBe(true);
  });

  test('TC-EXP-013：数量为 11 时应拒绝保存', () => {
    const result = validateExpense(
      createValidExpense({
        quantity: 11
      })
    );

    expect(result.valid).toBe(false);
  });

  test('TC-EXP-014：数量为 1.5 时应拒绝保存', () => {
    const result = validateExpense(
      createValidExpense({
        quantity: 1.5
      })
    );

    expect(result.valid).toBe(false);
  });

  test('TC-EXP-015：数量为负数时应拒绝保存', () => {
    const result = validateExpense(
      createValidExpense({
        quantity: -1
      })
    );

    expect(result.valid).toBe(false);
  });
});

describe('消费图片数量边界测试', () => {
  test('TC-EXP-016：9 张图片时应正常通过', () => {
    const images = Array.from(
      { length: 9 },
      (_, index) => `image-${index + 1}.jpg`
    );

    const result = validateExpense(
      createValidExpense({
        images
      })
    );

    expect(result.valid).toBe(true);
    expect(result.data.images).toHaveLength(9);
  });

  test('TC-EXP-017：10 张图片时应拒绝保存', () => {
    const images = Array.from(
      { length: 10 },
      (_, index) => `image-${index + 1}.jpg`
    );

    const result = validateExpense(
      createValidExpense({
        images
      })
    );

    expect(result.valid).toBe(false);
    expect(result.message).toBe('图片最多上传 9 张');
  });
});

describe('消费金额计算测试', () => {
  test('TC-EXP-018：单价 100 数量 3 时基础金额应为 300', () => {
    const total = calculateTotalAmount(
      createValidExpense({
        amount: 100,
        quantity: 3
      })
    );

    expect(total).toBe(300);
  });

  test('TC-EXP-019：附加费用应计入最终金额', () => {
    const total = calculateTotalAmount(
      createValidExpense({
        amount: 100,
        quantity: 2,
        fees: {
          shipping: 20,
          other: 10
        }
      })
    );

    expect(total).toBe(230);
  });

  test('TC-EXP-020：关闭计入总消费后统计金额应为 0', () => {
    const includedAmount = calculateIncludedAmount(
      createValidExpense({
        amount: 500,
        quantity: 1,
        includeInTotal: false
      })
    );

    expect(includedAmount).toBe(0);
  });

  test('TC-EXP-021：正常计入总消费时应返回实际金额', () => {
    const includedAmount = calculateIncludedAmount(
      createValidExpense({
        amount: 500,
        quantity: 2,
        includeInTotal: true
      })
    );

    expect(includedAmount).toBe(1000);
  });
});