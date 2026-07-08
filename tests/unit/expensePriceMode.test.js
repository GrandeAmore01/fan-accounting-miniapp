const {
  validateExpense,
  calculateTotalAmount
} = require('../../services/expenseService');

function createExpense(overrides = {}) {
  return {
    category: 'meet',
    subType: 'concert',
    itemName: '测试项目',
    amount: 100,
    quantity: 1,
    date: '2026-07-07',
    paymentMethod: '微信支付',
    purchaseChannel: 'official',
    priceMode: '',
    officialPrice: 100,
    actualUnitPrice: 0,
    totalPrice: 0,
    images: [],
    fees: {},
    includeInTotal: true,
    ...overrides
  };
}

describe('消费价格模式判定表测试', () => {
  test('TC-EXP-PRICE-001：见面官方渠道应使用官方票价而不是普通金额字段', () => {
    const expense = createExpense({
      category: 'meet',
      purchaseChannel: 'official',
      officialPrice: 580,
      amount: 999,
      quantity: 1
    });

    const result = calculateTotalAmount(expense);

    expect(result).toBe(580);
  });

  test('TC-EXP-PRICE-002：见面其他渠道最终金额应等于实际支付金额', () => {
    const expense = createExpense({
      category: 'meet',
      purchaseChannel: 'other',
      officialPrice: 580,
      amount: 880,
      quantity: 1
    });

    const result = calculateTotalAmount(expense);

    expect(result).toBe(880);
  });

  test('TC-EXP-PRICE-003：见面其他渠道金额可低于官方票价', () => {
    const expense = createExpense({
      category: 'meet',
      purchaseChannel: 'other',
      officialPrice: 580,
      amount: 300,
      quantity: 1
    });

    const validation = validateExpense(expense);
    const total = calculateTotalAmount(expense);

    expect(validation.valid).toBe(true);
    expect(total).toBe(300);
  });

  test('TC-EXP-PRICE-004：藏品官方渠道应使用官方单价乘数量', () => {
    const expense = createExpense({
      category: 'goods',
      subType: 'photo_card',
      purchaseChannel: 'official',
      officialPrice: 80,
      amount: 999,
      quantity: 3
    });

    const result = calculateTotalAmount(expense);

    expect(result).toBe(240);
  });

  test('TC-EXP-PRICE-005：藏品其他渠道按总价记录时应直接使用合计总价', () => {
    const expense = createExpense({
      category: 'goods',
      subType: 'photo_card',
      purchaseChannel: 'other',
      priceMode: 'total',
      amount: 999,
      totalPrice: 300,
      quantity: 5
    });

    const result = calculateTotalAmount(expense);

    expect(result).toBe(300);
  });

  test('TC-EXP-PRICE-006：藏品其他渠道按单价计算时应使用实际单价乘数量', () => {
    const expense = createExpense({
      category: 'goods',
      subType: 'photo_card',
      purchaseChannel: 'other',
      priceMode: 'unit',
      amount: 999,
      actualUnitPrice: 60,
      quantity: 4
    });

    const result = calculateTotalAmount(expense);

    expect(result).toBe(240);
  });

  test('TC-EXP-PRICE-007：交通费应直接使用实际总金额且不乘数量', () => {
    const expense = createExpense({
      category: 'travel',
      subType: '',
      purchaseChannel: '',
      amount: 450,
      quantity: 8
    });

    const result = calculateTotalAmount(expense);

    expect(result).toBe(450);
  });

  test('TC-EXP-PRICE-008：住宿费应直接使用实际总金额且不乘数量', () => {
    const expense = createExpense({
      category: 'hotel',
      subType: '',
      purchaseChannel: '',
      amount: 1200,
      quantity: 3
    });

    const result = calculateTotalAmount(expense);

    expect(result).toBe(1200);
  });

  test('TC-EXP-PRICE-009：其他分类应直接使用实际总金额且不乘数量', () => {
    const expense = createExpense({
      category: 'other',
      subType: '',
      purchaseChannel: '',
      amount: 200,
      quantity: 6
    });

    const result = calculateTotalAmount(expense);

    expect(result).toBe(200);
  });

  test('TC-EXP-PRICE-010：见面官方渠道未选择有效官方价格时应拒绝保存', () => {
    const expense = createExpense({
      category: 'meet',
      purchaseChannel: 'official',
      officialPrice: '',
      amount: 580
    });

    const result = validateExpense(expense);

    expect(result.valid).toBe(false);
  });

  test('TC-EXP-PRICE-011：藏品官方渠道官方价格异常时应拒绝保存', () => {
    const expense = createExpense({
      category: 'goods',
      purchaseChannel: 'official',
      officialPrice: 'abc',
      amount: 80,
      quantity: 2
    });

    const result = validateExpense(expense);

    expect(result.valid).toBe(false);
  });

  test('TC-EXP-PRICE-012：保存消费后应保留购买渠道字段', () => {
    const result = validateExpense(
      createExpense({
        purchaseChannel: 'other'
      })
    );

    expect(result.valid).toBe(true);
    expect(result.data.purchaseChannel).toBe('other');
  });

  test('TC-EXP-PRICE-013：保存藏品消费后应保留价格记录方式', () => {
    const result = validateExpense(
      createExpense({
        category: 'goods',
        purchaseChannel: 'other',
        priceMode: 'total',
        totalPrice: 300
      })
    );

    expect(result.valid).toBe(true);
    expect(result.data.priceMode).toBe('total');
  });

  test('TC-EXP-PRICE-014：保存官方消费后应保留官方价格字段', () => {
    const result = validateExpense(
      createExpense({
        purchaseChannel: 'official',
        officialPrice: 580
      })
    );

    expect(result.valid).toBe(true);
    expect(result.data.officialPrice).toBe(580);
  });
});