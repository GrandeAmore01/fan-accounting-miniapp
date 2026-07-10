const mockStorageService = {
  getCollection: jest.fn(),
  setCollection: jest.fn()
};

const mockStageService = {
  lightStage: jest.fn(),
  linkStageExpense: jest.fn(),
  clearStageExpenseLink: jest.fn(),
  ensureStagesLoaded: jest.fn(),
  listStages: jest.fn()
};

const mockApiService = {
  request: jest.fn(),
  buildQuery: jest.fn()
};

jest.mock('../services/storageService', () => mockStorageService);
jest.mock('../services/stageService', () => mockStageService);
jest.mock('../services/apiService', () => mockApiService);
jest.mock('../services/config', () => ({
  userId: 'test-user',
  useBackend: false,
  expenseApiBaseUrl: 'http://expense.test',
  apiBaseUrl: 'http://api.test'
}));

const expenseService = require('../services/expenseService');

function validExpense(overrides = {}) {
  return {
    expenseId: 'E001',
    category: 'meet',
    subType: 'concert',
    itemName: '演唱会门票',
    amount: '680',
    quantity: 1,
    date: '2026-07-10',
    stageDate: '2026-07-10',
    stageId: 'STAGE001',
    location: ' 上海 ',
    seat: ' A区1排 ',
    remark: ' 测试备注 ',
    city: ' 上海 ',
    pricingMode: 'direct',
    includeInTotal: true,
    ...overrides
  };
}

describe('M1 - expenseService 分类与金额逻辑', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageService.getCollection.mockReturnValue([]);
    mockApiService.buildQuery.mockReturnValue('?userId=test-user');
  });

  test('正确获取主分类、子分类和分类名称', () => {
    expect(expenseService.getMainType('meet')).toEqual(
      expect.objectContaining({
        id: 'meet',
        name: '见面'
      })
    );

    expect(
      expenseService.getSubType('meet', 'concert')
    ).toEqual({
      id: 'concert',
      name: '演唱会'
    });

    expect(
      expenseService.getSubType('unknown', 'concert')
    ).toBeNull();

    expect(
      expenseService.getCategoryName('meet', 'concert')
    ).toBe('见面 / 演唱会');

    expect(
      expenseService.getCategoryName('unknown', 'unknown')
    ).toBe('其他消费');
  });

  test('单价模式按照金额乘以数量计算', () => {
    expect(
      expenseService.calculateTotalAmount({
        amount: 100,
        quantity: 3,
        pricingMode: 'unit'
      })
    ).toBe(300);

    expect(
      expenseService.calculateTotalAmount({
        amount: 50,
        quantity: 4,
        pricingMode: 'official_unit'
      })
    ).toBe(200);
  });

  test('总价和直接金额模式不重复乘数量', () => {
    expect(
      expenseService.calculateTotalAmount({
        amount: 300,
        quantity: 5,
        pricingMode: 'total'
      })
    ).toBe(300);

    expect(
      expenseService.calculateTotalAmount({
        amount: 280,
        quantity: 2,
        pricingMode: 'direct'
      })
    ).toBe(280);
  });

  test('不计入总额的消费 includedAmount 为 0', () => {
    expect(
      expenseService.calculateIncludedAmount({
        amount: 680,
        pricingMode: 'direct',
        includeInTotal: false
      })
    ).toBe(0);

    expect(
      expenseService.calculateIncludedAmount({
        amount: 680,
        pricingMode: 'direct',
        includeInTotal: true
      })
    ).toBe(680);
  });

  test('金额统一格式化为两位小数', () => {
    expect(expenseService.formatMoney(12)).toBe('12.00');
    expect(expenseService.formatMoney('12.5')).toBe('12.50');
    expect(expenseService.formatMoney()).toBe('0.00');
  });
});

describe('M1 - expenseService 输入校验', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('消费项目名称为空时校验失败', () => {
    expect(
      expenseService.validateExpense(
        validExpense({ itemName: '   ' })
      )
    ).toEqual({
      valid: false,
      message: '请填写消费项目名称'
    });
  });

  test('消费日期为空时校验失败', () => {
    expect(
      expenseService.validateExpense(
        validExpense({ date: '' })
      )
    ).toEqual({
      valid: false,
      message: '请选择消费日期'
    });
  });

  test('见面分类未选择见面日期时校验失败', () => {
    expect(
      expenseService.validateExpense(
        validExpense({ stageDate: '' })
      )
    ).toEqual({
      valid: false,
      message: '请选择见面日期'
    });
  });

  test('金额为 0 或负数时校验失败', () => {
    expect(
      expenseService.validateExpense(
        validExpense({ amount: '0' })
      )
    ).toEqual({
      valid: false,
      message: '请输入大于 0 的金额'
    });

    expect(
      expenseService.validateExpense(
        validExpense({ amount: '-10' })
      )
    ).toEqual({
      valid: false,
      message: '请输入大于 0 的金额'
    });
  });

  test('金额超过两位小数时校验失败', () => {
    expect(
      expenseService.validateExpense(
        validExpense({ amount: '12.345' })
      )
    ).toEqual({
      valid: false,
      message: '金额最多保留两位小数'
    });
  });

  test('金额超过 100 万元时校验失败', () => {
    expect(
      expenseService.validateExpense(
        validExpense({ amount: '1000000.01' })
      )
    ).toEqual({
      valid: false,
      message: '金额不能超过 100 万元'
    });
  });

  test('不存在的消费分类校验失败', () => {
    expect(
      expenseService.validateExpense(
        validExpense({
          category: 'unknown',
          subType: 'unknown'
        })
      )
    ).toEqual({
      valid: false,
      message: '消费分类不正确'
    });
  });

  test.failing('已知缺陷 DEF-EXP-102：藏品数量 0 被默认转换为 1，数量边界校验失效', () => {
    const base = {
      category: 'collection',
      subType: 'goods',
      itemName: '测试徽章',
      amount: '20',
      date: '2026-07-10'
    };

    expect(
      expenseService.validateExpense({
        ...base,
        quantity: 0
      }).message
    ).toBe('藏品数量必须是 1 到 10 之间的整数');

    expect(
      expenseService.validateExpense({
        ...base,
        quantity: 11
      }).message
    ).toBe('藏品数量必须是 1 到 10 之间的整数');

    expect(
      expenseService.validateExpense({
        ...base,
        quantity: 1.5
      }).message
    ).toBe('藏品数量必须是 1 到 10 之间的整数');
  });

  test('合法消费通过校验并完成字段规范化', () => {
    const result = expenseService.validateExpense(
      validExpense()
    );

    expect(result.valid).toBe(true);

    expect(result.data).toEqual(
      expect.objectContaining({
        expenseId: 'E001',
        itemName: '演唱会门票',
        amount: 680,
        quantity: 1,
        location: '上海',
        seat: 'A区1排',
        remark: '测试备注',
        city: '上海',
        pricingMode: 'direct',
        includeInTotal: true
      })
    );

    expect(result.data.images).toEqual([]);
    expect(result.data.outfieldOnly).toBe(false);
  });
});

describe('M1 - expenseService 本地增删改查', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageService.getCollection.mockReturnValue([]);
  });

  test('读取消费记录时补充分组名称和金额字段', () => {
    mockStorageService.getCollection.mockReturnValue([
      validExpense({
        category: 'collection',
        subType: 'goods',
        itemName: '测试徽章',
        amount: 30,
        quantity: 2,
        pricingMode: 'unit',
        stageDate: ''
      })
    ]);

    const result = expenseService.listExpenses();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        categoryName: '藏品 / 周边',
        baseAmount: 60,
        totalAmount: 60,
        includedAmount: 60,
        images: [],
        outfieldOnly: false
      })
    );
  });

  test('新增见面消费时保存到首位并同步点亮舞台', () => {
    mockStorageService.getCollection.mockReturnValue([
      {
        expenseId: 'OLD001'
      }
    ]);

    const result = expenseService.addExpense(
      validExpense()
    );

    expect(result.valid).toBe(true);

    expect(mockStorageService.setCollection)
      .toHaveBeenCalledWith(
        'test-user',
        'expenses',
        [
          expect.objectContaining({
            expenseId: 'E001'
          }),
          {
            expenseId: 'OLD001'
          }
        ]
      );

    expect(mockStageService.lightStage)
      .toHaveBeenCalledWith('STAGE001');

    expect(mockStageService.linkStageExpense)
      .toHaveBeenCalledWith('STAGE001', 'E001');
  });

  test('修改消费时只替换指定记录', () => {
    mockStorageService.getCollection.mockReturnValue([
      {
        expenseId: 'E001',
        itemName: '旧名称'
      },
      {
        expenseId: 'E002',
        itemName: '保留记录'
      }
    ]);

    const result = expenseService.updateExpense(
      'E001',
      validExpense({
        itemName: '新名称'
      })
    );

    expect(result.valid).toBe(true);

    const saved =
      mockStorageService.setCollection.mock.calls[0][2];

    expect(saved).toHaveLength(2);
    expect(saved[0].itemName).toBe('新名称');
    expect(saved[1]).toEqual({
      expenseId: 'E002',
      itemName: '保留记录'
    });
  });

  test('删除消费时删除指定记录并清除舞台关联', () => {
    mockStorageService.getCollection.mockReturnValue([
      {
        expenseId: 'E001',
        stageId: 'STAGE001'
      },
      {
        expenseId: 'E002',
        stageId: ''
      }
    ]);

    const result =
      expenseService.removeExpense('E001');

    expect(result).toEqual([
      {
        expenseId: 'E002',
        stageId: ''
      }
    ]);

    expect(mockStorageService.setCollection)
      .toHaveBeenCalledWith(
        'test-user',
        'expenses',
        result
      );

    expect(mockStageService.clearStageExpenseLink)
      .toHaveBeenCalledWith('STAGE001', 'E001');
  });

  test('能够按分类和关键词筛选并计算消费汇总', () => {
    mockStorageService.getCollection.mockReturnValue([
      validExpense({
        expenseId: 'E001',
        itemName: '上海演唱会',
        amount: 680,
        location: '上海'
      }),
      validExpense({
        expenseId: 'E002',
        category: 'collection',
        subType: 'goods',
        itemName: '北京徽章',
        amount: 50,
        date: '2026-07-09',
        stageDate: '',
        stageId: '',
        location: '北京'
      })
    ]);

    const meetResult = expenseService.filterExpenses({
      category: 'meet',
      keyword: '上海'
    });

    expect(meetResult).toHaveLength(1);
    expect(meetResult[0].expenseId).toBe('E001');

    const summary =
      expenseService.getExpenseSummary();

    expect(summary).toEqual({
      totalAmount: 730,
      actualAmount: 730,
      count: 2
    });
  });

  test('分类统计包含全部消费和各主分类金额', () => {
    mockStorageService.getCollection.mockReturnValue([
      validExpense({
        expenseId: 'E001',
        amount: 680
      }),
      validExpense({
        expenseId: 'E002',
        category: 'collection',
        subType: 'goods',
        itemName: '测试周边',
        amount: 120,
        date: '2026-07-09',
        stageDate: '',
        stageId: ''
      })
    ]);

    const stats =
      expenseService.getCategoryStats();

    expect(stats.find((item) => item.id === 'all'))
      .toEqual(
        expect.objectContaining({
          amount: 800,
          actualAmount: 800,
          count: 2
        })
      );

    expect(stats.find((item) => item.id === 'meet'))
      .toEqual(
        expect.objectContaining({
          amount: 680,
          count: 1
        })
      );

    expect(
      stats.find((item) => item.id === 'collection')
    ).toEqual(
      expect.objectContaining({
        amount: 120,
        count: 1
      })
    );
  });
});

describe('M1 - expenseService 异步接口模式', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockApiService.buildQuery.mockReturnValue(
      '?userId=test-user'
    );
  });

  function loadBackendService() {
    jest.doMock('../services/config', () => ({
      userId: 'test-user',
      useBackend: true,
      expenseApiBaseUrl: 'http://expense.test',
      apiBaseUrl: 'http://api.test'
    }));

    return require('../services/expenseService');
  }

  test('后端模式通过 GET /expenses 获取并规范化记录', async () => {
    mockApiService.request.mockResolvedValue([
      {
        expenseId: 'E100',
        category: 'collection',
        subType: 'goods',
        itemName: '服务器周边',
        amount: 50,
        quantity: 2,
        pricingMode: 'unit',
        date: '2026-07-10',
        includeInTotal: true
      }
    ]);

    const backendService = loadBackendService();
    const result =
      await backendService.listExpensesAsync();

    expect(mockApiService.request)
      .toHaveBeenCalledWith({
        baseUrl: 'http://expense.test',
        url: '/expenses?userId=test-user'
      });

    expect(result[0]).toEqual(
      expect.objectContaining({
        expenseId: 'E100',
        categoryName: '藏品 / 周边',
        totalAmount: 100,
        includedAmount: 100
      })
    );
  });

  test('后端新增失败时返回接口错误信息', async () => {
    mockApiService.request.mockRejectedValue(
      new Error('服务器暂不可用')
    );

    const backendService = loadBackendService();

    const result =
      await backendService.addExpenseAsync(
        validExpense()
      );

    expect(result).toEqual({
      valid: false,
      message: '服务器暂不可用'
    });
  });
});


