const mockExpenseService = {
  listExpenses: jest.fn()
};

const mockStorageService = {
  getCollection: jest.fn(),
  setCollection: jest.fn()
};

jest.mock('../services/expenseService', () => mockExpenseService);
jest.mock('../services/storageService', () => mockStorageService);
jest.mock('../services/config', () => ({
  userId: 'test-user'
}));

const budgetService = require('../services/budgetService');

function buildExpenses() {
  return [
    {
      expenseId: 'E001',
      category: 'meet',
      subType: 'concert',
      categoryName: '见面 / 演唱会',
      includedAmount: 600,
      totalAmount: 600,
      includeInTotal: true,
      date: '2026-07-01'
    },
    {
      expenseId: 'E002',
      category: 'collection',
      subType: 'goods',
      categoryName: '藏品 / 周边',
      includedAmount: 300,
      totalAmount: 300,
      includeInTotal: true,
      date: '2026-07-15'
    },
    {
      expenseId: 'E003',
      category: 'transport',
      subType: 'travel',
      categoryName: '交通',
      includedAmount: 100,
      totalAmount: 100,
      includeInTotal: true,
      date: '2026-06-20'
    },
    {
      expenseId: 'E004',
      category: 'collection',
      subType: 'goods',
      categoryName: '藏品 / 周边',
      includedAmount: 200,
      totalAmount: 200,
      includeInTotal: false,
      date: '2026-07-20'
    }
  ];
}

function currentBudget(overrides = {}) {
  return {
    budgetId: 'budget_month_2026-07',
    budgetType: 'month',
    amount: 1000,
    threshold: 0.8,
    period: '2026-07',
    categoryBudgets: {
      meet_concert: 700,
      meet_new_year_concert: 0,
      meet_sports_day: 0,
      collection: 300,
      accommodation: 0,
      transport: 0,
      other: 0
    },
    ...overrides
  };
}

describe('M4 - budgetService 预算基础逻辑', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageService.getCollection.mockReturnValue([]);
    mockExpenseService.listExpenses.mockReturnValue([]);
  });

  test.failing('已知缺陷 DEF-BUD-102：预算目标分类体系与消费模块分类体系不一致', () => {
    const targets = budgetService.getBudgetTargets();

    expect(targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'meet_concert',
          category: 'meet',
          subType: 'concert'
        }),
        expect.objectContaining({
          id: 'collection',
          category: 'collection'
        }),
        expect.objectContaining({
          id: 'transport',
          category: 'transport'
        })
      ])
    );
  });

  test('月份和年份默认周期格式正确', () => {
    expect(
      budgetService.getCurrentMonth()
    ).toMatch(/^\d{4}-\d{2}$/);

    expect(
      budgetService.getCurrentYear()
    ).toMatch(/^\d{4}$/);

    expect(
      budgetService.getDefaultPeriod('year')
    ).toMatch(/^\d{4}$/);

    expect(
      budgetService.getDefaultPeriod('month')
    ).toMatch(/^\d{4}-\d{2}$/);
  });

  test('未保存预算时返回金额 0 和默认阈值 80%', () => {
    const result =
      budgetService.getBudget('month', '2026-07');

    expect(result).toEqual(
      expect.objectContaining({
        budgetType: 'month',
        period: '2026-07',
        amount: 0,
        threshold: 0.8
      })
    );
  });

  test('已保存预算按预算类型和周期读取', () => {
    mockStorageService.getCollection.mockReturnValue([
      currentBudget(),
      currentBudget({
        budgetId: 'budget_year_2026',
        budgetType: 'year',
        period: '2026',
        amount: 12000
      })
    ]);

    const result =
      budgetService.getBudget('month', '2026-07');

    expect(result.amount).toBe(1000);
    expect(result.period).toBe('2026-07');
  });
});

describe('M4 - budgetService 输入校验与保存', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageService.getCollection.mockReturnValue([]);
  });

  test('总预算为 0 时校验失败', () => {
    expect(
      budgetService.validateBudget(
        currentBudget({ amount: 0 })
      )
    ).toEqual({
      valid: false,
      message: '请输入大于 0 的预算金额'
    });
  });

  test('总预算为负数时校验失败', () => {
    expect(
      budgetService.validateBudget(
        currentBudget({ amount: -1 })
      )
    ).toEqual({
      valid: false,
      message: '请输入大于 0 的预算金额'
    });
  });

  test('提醒阈值为 0 时校验失败', () => {
    expect(
      budgetService.validateBudget(
        currentBudget({ threshold: 0 })
      )
    ).toEqual({
      valid: false,
      message: '提醒阈值需在 1% 到 100% 之间'
    });
  });

  test('提醒阈值超过 100% 时校验失败', () => {
    expect(
      budgetService.validateBudget(
        currentBudget({ threshold: 1.01 })
      )
    ).toEqual({
      valid: false,
      message: '提醒阈值需在 1% 到 100% 之间'
    });
  });

  test.failing('已知缺陷 DEF-BUD-102：消费分类 ID 不一致导致部分分类预算未计入总额校验', () => {
    expect(
      budgetService.validateBudget(
        currentBudget({
          amount: 500,
          categoryBudgets: {
            meet_concert: 400,
            collection: 200
          }
        })
      )
    ).toEqual({
      valid: false,
      message: '分类预算总额不能超过总预算'
    });
  });

  test.failing('已知缺陷 DEF-BUD-102：collection 分类预算在规范化时被丢弃', () => {
    const result =
      budgetService.validateBudget(
        currentBudget({
          amount: '1000',
          threshold: 0.75,
          categoryBudgets: {
            meet_concert: '600',
            collection: '300'
          }
        })
      );

    expect(result.valid).toBe(true);

    expect(result.data).toEqual(
      expect.objectContaining({
        budgetType: 'month',
        amount: 1000,
        threshold: 0.75,
        period: '2026-07'
      })
    );

    expect(result.data.categoryBudgets.meet_concert)
      .toBe(600);

    expect(result.data.categoryBudgets.collection)
      .toBe(300);
  });

  test('保存同周期预算时替换旧预算并保留其他周期', () => {
    mockStorageService.getCollection.mockReturnValue([
      currentBudget({
        amount: 500
      }),
      currentBudget({
        budgetId: 'budget_month_2026-06',
        period: '2026-06',
        amount: 600
      })
    ]);

    const result =
      budgetService.saveBudget(
        currentBudget({
          amount: 1000
        })
      );

    expect(result.valid).toBe(true);

    const saved =
      mockStorageService.setCollection.mock.calls[0][2];

    expect(saved).toHaveLength(2);
    expect(saved[0].amount).toBe(1000);
    expect(saved[0].period).toBe('2026-07');
    expect(saved[1].period).toBe('2026-06');
  });
});

describe('M4 - budgetService 周期消费与预算进度', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockExpenseService.listExpenses.mockReturnValue(
      buildExpenses()
    );

    mockStorageService.getCollection.mockImplementation(
      (userId, collectionName) => {
        if (collectionName === 'budgets') {
          return [currentBudget()];
        }
        return [];
      }
    );
  });

  test('月预算只统计本月且计入总额的消费', () => {
    const expenses =
      budgetService.getPeriodExpenses(
        'month',
        '2026-07'
      );

    expect(expenses.map((item) => item.expenseId))
      .toEqual(['E001', 'E002']);
  });

  test('年预算按年份统计消费', () => {
    const expenses =
      budgetService.getPeriodExpenses(
        'year',
        '2026'
      );

    expect(expenses.map((item) => item.expenseId))
      .toEqual(['E001', 'E002', 'E003']);
  });

  test('预算进度正确计算使用率、剩余金额和阈值状态', () => {
    const result =
      budgetService.getBudgetProgress(
        'month',
        '2026-07'
      );

    expect(result).toEqual(
      expect.objectContaining({
        totalAmount: 900,
        remainingAmount: 100,
        usedRate: 0.9,
        percent: 90,
        thresholdPercent: 80,
        isOverThreshold: true,
        isOverBudget: false
      })
    );
  });

  test('超预算时剩余金额最低为 0 且标记超支', () => {
    mockStorageService.getCollection.mockReturnValue([
      currentBudget({
        amount: 800,
        categoryBudgets: {}
      })
    ]);

    const result =
      budgetService.getBudgetProgress(
        'month',
        '2026-07'
      );

    expect(result.remainingAmount).toBe(0);
    expect(result.percent).toBe(113);
    expect(result.isOverThreshold).toBe(true);
    expect(result.isOverBudget).toBe(true);
  });

  test('未设置预算时使用率和百分比均为 0', () => {
    mockStorageService.getCollection.mockReturnValue([]);

    const result =
      budgetService.getBudgetProgress(
        'month',
        '2026-07'
      );

    expect(result.budget.amount).toBe(0);
    expect(result.usedRate).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.isOverThreshold).toBe(false);
    expect(result.isOverBudget).toBe(false);
  });
});

describe('M4 - budgetService 分类统计与预警', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockExpenseService.listExpenses.mockReturnValue(
      buildExpenses()
    );

    mockStorageService.getCollection.mockReturnValue([
      currentBudget()
    ]);
  });

  test('消费分类统计按金额降序并计算占比', () => {
    const stats =
      budgetService.getCategoryStats(
        'month',
        '2026-07'
      );

    expect(stats[0]).toEqual(
      expect.objectContaining({
        category: 'meet',
        amount: 600,
        count: 1,
        percent: 67
      })
    );

    expect(stats[1]).toEqual(
      expect.objectContaining({
        category: 'collection',
        amount: 300,
        count: 1,
        percent: 33
      })
    );
  });

  test.failing('已知缺陷 DEF-BUD-102：collection 消费无法匹配预算分类统计', () => {
    const stats =
      budgetService.getCategoryBudgetStats(
        'month',
        '2026-07'
      );

    const meet = stats.find(
      (item) => item.category === 'meet_concert'
    );

    const collection = stats.find(
      (item) => item.category === 'collection'
    );

    expect(meet).toEqual(
      expect.objectContaining({
        budgetAmount: 700,
        usedAmount: 600,
        remainingAmount: 100,
        count: 1,
        percent: 86,
        isOverBudget: false,
        isUnset: false
      })
    );

    expect(collection).toEqual(
      expect.objectContaining({
        budgetAmount: 300,
        usedAmount: 300,
        remainingAmount: 0,
        count: 1,
        percent: 100,
        isOverBudget: false,
        isUnset: false
      })
    );
  });

  test('达到总预算提醒阈值时生成 warn 预警', () => {
    const warnings =
      budgetService.getBudgetWarnings(
        'month',
        '2026-07'
      );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'warn',
          title: '总预算达到提醒线',
          period: '2026-07'
        })
      ])
    );
  });

  test('超过总预算时生成 danger 预警', () => {
    mockStorageService.getCollection.mockReturnValue([
      currentBudget({
        amount: 800,
        categoryBudgets: {}
      })
    ]);

    const warnings =
      budgetService.getBudgetWarnings(
        'month',
        '2026-07'
      );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'danger',
          title: '总预算已超支'
        })
      ])
    );
  });

  test.failing('已知缺陷 DEF-BUD-102：分类 ID 不一致导致部分分类预算预警缺失', () => {
    const warnings =
      budgetService.getBudgetWarnings(
        'month',
        '2026-07'
      );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'warn',
          title: expect.stringContaining(
            '演唱会分类预算接近上限'
          )
        }),
        expect.objectContaining({
          level: 'warn',
          title: expect.stringContaining(
            '藏品分类预算接近上限'
          )
        })
      ])
    );
  });
});

describe('M4 - budgetService 对比、趋势和仪表盘', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockExpenseService.listExpenses.mockReturnValue(
      buildExpenses()
    );

    mockStorageService.getCollection.mockReturnValue([
      currentBudget(),
      currentBudget({
        budgetId: 'budget_month_2026-06',
        period: '2026-06',
        amount: 500,
        categoryBudgets: {}
      })
    ]);
  });

  test('预算对比正确计算上升趋势和差额', () => {
    const result =
      budgetService.getBudgetComparison(
        'month',
        '2026-07'
      );

    expect(result).toEqual({
      currentAmount: 900,
      previousPeriod: '2026-06',
      previousAmount: 100,
      diffAmount: 800,
      diffPercent: 800,
      trend: 'up'
    });
  });

  test('月趋势按月份汇总消费并以最大值计算百分比', () => {
    const trend =
      budgetService.getMonthTrend(
        '2026-07',
        12
      );

    expect(trend).toEqual(
      expect.arrayContaining([
        {
          month: '2026-06',
          amount: 100,
          percent: 11
        },
        {
          month: '2026-07',
          amount: 900,
          percent: 100
        }
      ])
    );
  });

  test('预算洞察包含评分、等级、风险分类和建议', () => {
    const insight =
      budgetService.getBudgetInsight(
        'month',
        '2026-07'
      );

    expect(insight.score).toEqual(
      expect.any(Number)
    );

    expect([
      '优秀',
      '良好',
      '需关注',
      '风险'
    ]).toContain(insight.level);

    expect(insight.mainReason).toEqual(
      expect.any(String)
    );

    expect(insight.suggestion).toEqual(
      expect.any(String)
    );

    expect(Array.isArray(insight.riskCategories))
      .toBe(true);

    expect(
      Array.isArray(insight.unsetCategoryHints)
    ).toBe(true);
  });

  test('预算仪表盘一次聚合核心预算数据', () => {
    const dashboard =
      budgetService.getBudgetDashboard(
        'month',
        '2026-07'
      );

    expect(dashboard).toEqual(
      expect.objectContaining({
        progress: expect.any(Object),
        categoryStats: expect.any(Array),
        categoryBudgetStats: expect.any(Array),
        comparison: expect.any(Object),
        warnings: expect.any(Array),
        budgetHistory: expect.any(Array),
        insight: expect.any(Object),
        monthTrend: expect.any(Array)
      })
    );
  });
});


