const {
  addExpense,
  filterExpenses,
  listExpenses
} = require('../../services/expenseService');

function createExpense(overrides = {}) {
  return {
    expenseId: 'expense-default',
    category: 'meet',
    subType: 'concert',
    itemName: '默认测试消费',
    amount: 100,
    quantity: 1,
    date: '2026-07-01',
    paymentMethod: '微信支付',
    city: '',
    location: '',
    seat: '',
    remark: '',
    images: [],
    fees: {},
    includeInTotal: true,
    ...overrides
  };
}

function prepareExpenses() {
  addExpense(
    createExpense({
      expenseId: 'expense-beijing',
      category: 'meet',
      subType: 'concert',
      itemName: '北京演唱会',
      city: '北京',
      location: '国家体育场',
      date: '2026-07-01'
    })
  );

  addExpense(
    createExpense({
      expenseId: 'expense-chongqing',
      category: 'meet',
      subType: 'activity',
      itemName: '重庆周年活动',
      city: '重庆',
      location: '国际博览中心',
      date: '2026-07-20'
    })
  );

  addExpense(
    createExpense({
      expenseId: 'expense-shanghai-goods',
      category: 'goods',
      subType: 'photo_card',
      itemName: '上海购买小卡',
      city: '上海',
      location: '上海线下店',
      date: '2026-07-15'
    })
  );
}

beforeEach(() => {
  wx.clearStorageSync();
  prepareExpenses();
});

describe('消费城市筛选黑盒测试', () => {
  test('TC-EXP-CITY-001：按北京筛选应只返回北京见面消费', () => {
    const result = filterExpenses({
      category: 'all',
      keyword: '',
      city: '北京'
    });

    expect(result).toHaveLength(1);
    expect(result[0].itemName).toBe('北京演唱会');
    expect(result[0].category).toBe('meet');
  });

  test('TC-EXP-CITY-002：按重庆筛选应只返回重庆见面消费', () => {
    const result = filterExpenses({
      category: 'all',
      keyword: '',
      city: '重庆'
    });

    expect(result).toHaveLength(1);
    expect(result[0].itemName).toBe('重庆周年活动');
    expect(result[0].category).toBe('meet');
  });

  test('TC-EXP-CITY-003：城市筛选不应返回非见面消费', () => {
    const result = filterExpenses({
      category: 'all',
      keyword: '',
      city: '上海'
    });

    expect(result).toHaveLength(0);
  });

  test('TC-EXP-CITY-004：城市与关键词组合筛选应同时满足条件', () => {
    const result = filterExpenses({
      category: 'meet',
      keyword: '见面',
      city: '重庆'
    });

    expect(result).toHaveLength(1);
    expect(result[0].itemName).toBe('重庆周年活动');
    expect(result[0].category).toBe('meet');
  });

  test('TC-EXP-CITY-005：城市无匹配结果时应返回空列表', () => {
    const result = filterExpenses({
      category: 'all',
      keyword: '',
      city: '广州'
    });

    expect(result).toHaveLength(0);
  });

  test('TC-EXP-CITY-006：清除城市条件后应恢复全部消费记录', () => {
    const result = filterExpenses({
      category: 'all',
      keyword: '',
      city: ''
    });

    expect(result).toHaveLength(3);
  });

  test('TC-EXP-CITY-007：保存见面消费后应保留城市字段', () => {
    const expenses = listExpenses();

    const beijingExpense = expenses.find(
      (item) => item.expenseId === 'expense-beijing'
    );

    expect(beijingExpense).toBeDefined();
    expect(beijingExpense.city).toBe('北京');
  });
});