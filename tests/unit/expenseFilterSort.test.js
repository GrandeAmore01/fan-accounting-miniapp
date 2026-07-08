const {
  addExpense,
  filterExpenses
} = require('../../services/expenseService');

function createExpense(overrides = {}) {
  return {
    expenseId: 'expense-default',
    category: 'goods',
    subType: 'photo_card',
    itemName: '默认测试消费',
    amount: 100,
    quantity: 1,
    date: '2026-07-01',
    paymentMethod: '微信支付',
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
      amount: 300,
      date: '2026-07-01',
      location: '北京国家体育场',
      seat: 'A区10排',
      remark: '第一次现场看演唱会'
    })
  );

  addExpense(
    createExpense({
      expenseId: 'expense-card',
      category: 'goods',
      subType: 'photo_card',
      itemName: '成员小卡套装',
      amount: 100,
      date: '2026-07-20',
      location: '上海线下店',
      remark: '收藏纪念'
    })
  );

  addExpense(
    createExpense({
      expenseId: 'expense-chongqing',
      category: 'meet',
      subType: 'activity',
      itemName: '重庆周年活动',
      amount: 500,
      date: '2026-06-15',
      location: '重庆国际博览中心',
      seat: '内场B区',
      remark: '和朋友同行'
    })
  );
}

beforeEach(() => {
  wx.clearStorageSync();
  prepareExpenses();
});

describe('消费关键词搜索黑盒测试', () => {
  test('TC-EXP-SRCH-001：按项目名称搜索应返回匹配记录', () => {
    const result = filterExpenses({
      category: 'all',
      keyword: '小卡'
    });

    expect(result).toHaveLength(1);
    expect(result[0].itemName).toBe('成员小卡套装');
  });

  test('TC-EXP-SRCH-002：按日期搜索应返回匹配记录', () => {
    const result = filterExpenses({
      category: 'all',
      keyword: '2026-07-20'
    });

    expect(result).toHaveLength(1);
    expect(result[0].itemName).toBe('成员小卡套装');
  });

  test('TC-EXP-SRCH-003：按地点搜索应返回匹配记录', () => {
    const result = filterExpenses({
      category: 'all',
      keyword: '重庆'
    });

    expect(result).toHaveLength(1);
    expect(result[0].itemName).toBe('重庆周年活动');
  });

  test('TC-EXP-SRCH-004：按备注搜索应返回匹配记录', () => {
    const result = filterExpenses({
      category: 'all',
      keyword: '朋友'
    });

    expect(result).toHaveLength(1);
    expect(result[0].itemName).toBe('重庆周年活动');
  });

  test('TC-EXP-SRCH-005：无匹配关键词时应返回空结果', () => {
    const result = filterExpenses({
      category: 'all',
      keyword: '完全不存在的消费'
    });

    expect(result).toHaveLength(0);
  });
});

describe('消费分类与组合筛选黑盒测试', () => {
  test('TC-EXP-FLT-001：筛选周边分类应只返回周边消费', () => {
    const result = filterExpenses({
      category: 'goods',
      keyword: ''
    });

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('goods');
    expect(result[0].itemName).toBe('成员小卡套装');
  });

  test('TC-EXP-FLT-002：筛选见面分类应只返回见面消费', () => {
    const result = filterExpenses({
      category: 'meet',
      keyword: ''
    });

    expect(result).toHaveLength(2);

    result.forEach((expense) => {
      expect(expense.category).toBe('meet');
    });
  });

  test('TC-EXP-FLT-003：分类与关键词组合筛选应同时满足条件', () => {
    const result = filterExpenses({
      category: 'meet',
      keyword: '北京'
    });

    expect(result).toHaveLength(1);
    expect(result[0].itemName).toBe('北京演唱会');
    expect(result[0].category).toBe('meet');
  });

  test('TC-EXP-FLT-004：关键词匹配但分类不匹配时应返回空结果', () => {
    const result = filterExpenses({
      category: 'goods',
      keyword: '北京'
    });

    expect(result).toHaveLength(0);
  });
});

describe('消费排序黑盒测试', () => {
  test('TC-EXP-SORT-001：默认应按日期从新到旧排序', () => {
    const result = filterExpenses({
      category: 'all',
      keyword: ''
    });

    expect(result.map((item) => item.itemName)).toEqual([
      '成员小卡套装',
      '北京演唱会',
      '重庆周年活动'
    ]);
  });

  test('TC-EXP-SORT-002：按金额从低到高排序', () => {
    const result = filterExpenses({
      category: 'all',
      keyword: '',
      sort: 'amountAsc'
    });

    expect(result.map((item) => item.totalAmount)).toEqual([
      100,
      300,
      500
    ]);
  });

  test('TC-EXP-SORT-003：按金额从高到低排序', () => {
    const result = filterExpenses({
      category: 'all',
      keyword: '',
      sort: 'amountDesc'
    });

    expect(result.map((item) => item.totalAmount)).toEqual([
      500,
      300,
      100
    ]);
  });

  test('TC-EXP-SORT-004：筛选后仍应保持日期从新到旧排序', () => {
    const result = filterExpenses({
      category: 'meet',
      keyword: ''
    });

    expect(result.map((item) => item.itemName)).toEqual([
      '北京演唱会',
      '重庆周年活动'
    ]);
  });
});