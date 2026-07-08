const {
  addExpense,
  listExpenses,
  updateExpense,
  removeExpense
} = require('../../services/expenseService');

function createExpense(overrides = {}) {
  return {
    expenseId: 'expense-test-001',
    category: 'goods',
    subType: 'photo_card',
    itemName: '测试小卡',
    amount: 100,
    quantity: 1,
    date: '2026-07-07',
    paymentMethod: '微信支付',
    seat: '',
    location: '测试线下店',
    remark: '原始备注',
    images: ['image-1.jpg'],
    fees: {},
    includeInTotal: true,
    ...overrides
  };
}

beforeEach(() => {
  wx.clearStorageSync();
});

describe('消费记录新增与读取 CRUD 测试', () => {
  test('TC-EXP-CRUD-001：新增有效消费后应保存成功', () => {
    const result = addExpense(createExpense());

    expect(result.valid).toBe(true);

    const expenses = listExpenses();

    expect(expenses).toHaveLength(1);
    expect(expenses[0].expenseId).toBe('expense-test-001');
  });

  test('TC-EXP-CRUD-002：新增后重新读取应获得最新消费数据', () => {
    addExpense(
      createExpense({
        itemName: '重新读取测试消费',
        amount: 280
      })
    );

    const firstRead = listExpenses();
    const secondRead = listExpenses();

    expect(firstRead).toHaveLength(1);
    expect(secondRead).toHaveLength(1);
    expect(secondRead[0].itemName).toBe('重新读取测试消费');
    expect(secondRead[0].amount).toBe(280);
  });

  test('TC-EXP-CRUD-003：新增后应保留基础消费字段', () => {
    addExpense(
      createExpense({
        itemName: '字段保存测试',
        amount: 199.99,
        quantity: 2,
        date: '2026-07-15',
        paymentMethod: '支付宝',
        location: '重庆测试店',
        remark: '测试备注内容',
        images: ['a.jpg', 'b.jpg']
      })
    );

    const expense = listExpenses()[0];

    expect(expense.itemName).toBe('字段保存测试');
    expect(expense.amount).toBe(199.99);
    expect(expense.quantity).toBe(2);
    expect(expense.date).toBe('2026-07-15');
    expect(expense.paymentMethod).toBe('支付宝');
    expect(expense.location).toBe('重庆测试店');
    expect(expense.remark).toBe('测试备注内容');
    expect(expense.images).toEqual(['a.jpg', 'b.jpg']);
  });

  test('TC-EXP-CRUD-004：非法新增不应写入消费记录', () => {
    const result = addExpense(
      createExpense({
        amount: 0
      })
    );

    expect(result.valid).toBe(false);
    expect(listExpenses()).toHaveLength(0);
  });
});

describe('消费记录编辑 CRUD 测试', () => {
  test('TC-EXP-CRUD-005：编辑已有消费后应更新数据', () => {
    addExpense(createExpense());

    const result = updateExpense(
      'expense-test-001',
      createExpense({
        itemName: '修改后的小卡',
        amount: 300,
        quantity: 2,
        date: '2026-07-20',
        paymentMethod: '银行卡',
        location: '北京测试店',
        remark: '修改后的备注',
        images: ['new-1.jpg', 'new-2.jpg']
      })
    );

    expect(result.valid).toBe(true);

    const expense = listExpenses()[0];

    expect(expense.itemName).toBe('修改后的小卡');
    expect(expense.amount).toBe(300);
    expect(expense.quantity).toBe(2);
    expect(expense.date).toBe('2026-07-20');
    expect(expense.paymentMethod).toBe('银行卡');
    expect(expense.location).toBe('北京测试店');
    expect(expense.remark).toBe('修改后的备注');
    expect(expense.images).toEqual(['new-1.jpg', 'new-2.jpg']);
  });

  test('TC-EXP-CRUD-006：编辑消费后应保留原 expenseId', () => {
    addExpense(createExpense());

    updateExpense(
      'expense-test-001',
      createExpense({
        expenseId: 'wrong-new-id',
        itemName: 'ID 保留测试'
      })
    );

    const expenses = listExpenses();

    expect(expenses).toHaveLength(1);
    expect(expenses[0].expenseId).toBe('expense-test-001');
  });

  test('TC-EXP-CRUD-007：编辑已有记录不应创建重复消费', () => {
    addExpense(createExpense());

    updateExpense(
      'expense-test-001',
      createExpense({
        itemName: '编辑后记录'
      })
    );

    const expenses = listExpenses();

    expect(expenses).toHaveLength(1);
    expect(expenses[0].itemName).toBe('编辑后记录');
  });

  test('TC-EXP-CRUD-008：编辑校验失败后应保留原消费数据', () => {
    addExpense(
      createExpense({
        itemName: '原始有效记录',
        amount: 100
      })
    );

    const result = updateExpense(
      'expense-test-001',
      createExpense({
        itemName: '不应保存的修改',
        amount: 0
      })
    );

    expect(result.valid).toBe(false);

    const expenses = listExpenses();

    expect(expenses).toHaveLength(1);
    expect(expenses[0].itemName).toBe('原始有效记录');
    expect(expenses[0].amount).toBe(100);
  });
});

describe('消费记录删除 CRUD 测试', () => {
  test('TC-EXP-CRUD-009：删除已有消费后记录应消失', () => {
    addExpense(createExpense());

    removeExpense('expense-test-001');

    const expenses = listExpenses();

    expect(expenses).toHaveLength(0);
  });

  test('TC-EXP-CRUD-010：删除一条消费不应影响其他记录', () => {
    addExpense(
      createExpense({
        expenseId: 'expense-test-001',
        itemName: '第一条消费'
      })
    );

    addExpense(
      createExpense({
        expenseId: 'expense-test-002',
        itemName: '第二条消费'
      })
    );

    removeExpense('expense-test-001');

    const expenses = listExpenses();

    expect(expenses).toHaveLength(1);
    expect(expenses[0].expenseId).toBe('expense-test-002');
    expect(expenses[0].itemName).toBe('第二条消费');
  });
});

describe('消费记录状态与重复提交测试', () => {
  test('TC-EXP-CRUD-011：不计入总消费状态应正确保存', () => {
    addExpense(
      createExpense({
        includeInTotal: false
      })
    );

    const expense = listExpenses()[0];

    expect(expense.includeInTotal).toBe(false);
    expect(expense.includedAmount).toBe(0);
  });

  test('TC-EXP-CRUD-012：相同消费连续提交不应产生重复记录', () => {
    const expense = createExpense({
      expenseId: 'expense-duplicate-test',
      itemName: '重复提交测试'
    });

    addExpense(expense);
    addExpense(expense);

    const expenses = listExpenses();

    expect(expenses).toHaveLength(1);
    expect(expenses[0].expenseId).toBe('expense-duplicate-test');
  });
});