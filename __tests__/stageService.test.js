const mockStorageService = {
  getCollection: jest.fn(),
  setCollection: jest.fn()
};

const mockApiService = {
  request: jest.fn()
};

const mockExpenseService = {
  listExpenses: jest.fn(),
  addExpense: jest.fn(),
  removeExpense: jest.fn()
};

const localStages = [
  {
    stageId: 'S001',
    stageName: '上海演唱会',
    stageType: 'concert',
    year: 2026,
    date: '2026-07-01',
    city: '上海',
    venue: '上海体育场',
    location: '上海体育场',
    albumId: 'A1',
    songList: ['晴天', '夜曲', '稻香'],
    priceTiers: [1080, 580, 1080, '780', 0, -1],
    ticketPrice: 999
  },
  {
    stageId: 'S002',
    stageName: '北京音乐节',
    stageType: 'festival',
    year: 2025,
    date: '2025-08-02',
    city: '北京',
    venue: '北京公园',
    location: '北京公园',
    albumId: 'A2',
    songList: ['稻香', '花海'],
    priceTiers: [],
    ticketPrice: 680
  },
  {
    stageId: 'S003',
    stageName: '广州演唱会',
    stageType: 'concert',
    year: 2024,
    date: '2024-05-20',
    city: '广州',
    venue: '广州体育馆',
    location: '广州体育馆',
    albumId: '',
    songList: [],
    priceTiers: [380],
    ticketPrice: 380
  }
];

jest.mock('../data/stages', () => localStages);
jest.mock('../services/storageService', () => mockStorageService);
jest.mock('../services/apiService', () => mockApiService);
jest.mock('../services/config', () => ({
  userId: 'test-user',
  useStageBackend: false
}));
jest.mock('../services/expenseService', () => mockExpenseService);

const stageService = require('../services/stageService');

const store = {
  userStages: [],
  stageNotes: [],
  expenses: []
};

function resetStore() {
  store.userStages = [];
  store.stageNotes = [];
  store.expenses = [];
}

describe('M3 - stageService 舞台基础数据', () => {
  beforeAll(async () => {
    mockStorageService.getCollection.mockImplementation(
      (userId, collectionName) =>
        store[collectionName] || []
    );

    mockStorageService.setCollection.mockImplementation(
      (userId, collectionName, value) => {
        store[collectionName] = value;
      }
    );

    mockExpenseService.listExpenses.mockImplementation(
      () => store.expenses
    );

    await stageService.ensureStagesLoaded();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();

    mockStorageService.getCollection.mockImplementation(
      (userId, collectionName) =>
        store[collectionName] || []
    );

    mockStorageService.setCollection.mockImplementation(
      (userId, collectionName, value) => {
        store[collectionName] = value;
      }
    );

    mockExpenseService.listExpenses.mockImplementation(
      () => store.expenses
    );
  });

  test('舞台数据加载后完成歌曲、票档和显示字段补充', () => {
    const stages = stageService.listStages();

    expect(stages).toHaveLength(4);

    expect(stages[0]).toEqual(
      expect.objectContaining({
        stageId: 'S001',
        stageName: '上海演唱会',
        songCount: 3,
        songListText: '晴天、夜曲、稻香',
        priceTiers: [580, 780, 1080],
        priceTierText: '580元 / 780元 / 1080元',
        ticketPrice: 580,
        isLighted: false
      })
    );
  });

  test('年份选项按年份倒序生成', () => {
    expect(stageService.getYearOptions()).toEqual([
      {
        id: 'all',
        name: '全部年份'
      },
      {
        id: '2026',
        name: '2026年'
      },
      {
        id: '2025',
        name: '2025年'
      },
      {
        id: '2024',
        name: '2024年'
      }
    ]);

    expect(stageService.getStatsYearOptions()).toEqual([
      {
        id: '2026',
        name: '2026年'
      },
      {
        id: '2025',
        name: '2025年'
      },
      {
        id: '2024',
        name: '2024年'
      }
    ]);
  });

  test('票档去重、过滤非正数并按价格升序排列', () => {
    expect(
      stageService.getValidPriceTiers([
        1080,
        '580',
        780,
        1080,
        0,
        -100
      ])
    ).toEqual([580, 780, 1080]);
  });

  test('专辑名称根据舞台歌曲和专辑信息获取', () => {
    const stage = stageService.listStages()[0];

    expect(stageService.getStageAlbumNames(stage))
      .toEqual(['A1']);

    expect(stageService.getAllAlbumNames())
      .toEqual(
        expect.arrayContaining(['A1', 'A2'])
      );
  });
});

describe('M3 - stageService 观演备注与取消点亮', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();

    mockStorageService.getCollection.mockImplementation(
      (userId, collectionName) =>
        store[collectionName] || []
    );

    mockStorageService.setCollection.mockImplementation(
      (userId, collectionName, value) => {
        store[collectionName] = value;
      }
    );

    mockExpenseService.listExpenses.mockImplementation(
      () => store.expenses
    );
  });

  test('未保存回忆时返回默认空备注且不再包含照片字段', () => {
    expect(stageService.getStageNote('S001')).toEqual({
      stageId: 'S001',
      seat: '',
      companions: '',
      note: '',
      actualTicketPrice: 0
    });
  });

  test('非数字实际票价保存失败', async () => {
    await expect(
      stageService.saveStageNote('S001', {
        actualTicketPrice: 'abc'
      })
    ).resolves.toEqual({
      valid: false,
      message: '票价必须为数字'
    });
  });

  test('实际票价为0时保存失败', async () => {
    await expect(
      stageService.saveStageNote('S001', {
        actualTicketPrice: '0'
      })
    ).resolves.toEqual({
      valid: false,
      message: '票价必须大于 0'
    });
  });

  test('保存观演备注时实际票价转为数字', async () => {
    const result = await stageService.saveStageNote(
      'S001',
      {
        seat: 'A区1排',
        companions: '朋友A',
        note: '第一次现场',
        actualTicketPrice: '680'
      }
    );

    expect(result.valid).toBe(true);

    expect(result.data).toEqual(
      expect.objectContaining({
        stageId: 'S001',
        seat: 'A区1排',
        companions: '朋友A',
        note: '第一次现场',
        actualTicketPrice: 680
      })
    );

    expect(stageService.getStageNote('S001')).toEqual(
      expect.objectContaining({
        seat: 'A区1排',
        companions: '朋友A',
        note: '第一次现场',
        actualTicketPrice: 680
      })
    );
  });

  test('倒计时占位场次存在但不计入舞台进度总数', () => {
    const placeholder = stageService.listStages().find(
      (item) =>
        item.stageId === 'stage_countdown_placeholder'
    );

    expect(placeholder).toEqual(
      expect.objectContaining({
        stageName: '下一见面（待定场次）',
        isCountdownPlaceholder: true
      })
    );

    expect(stageService.getStageStats()).toEqual(
      expect.objectContaining({
        total: 3
      })
    );
  });

  test('取消点亮后清空观演备注', async () => {
    await stageService.lightStage('S001');

    await stageService.saveStageNote('S001', {
      seat: 'A区1排',
      companions: '朋友A',
      note: '需要清空的备注',
      actualTicketPrice: '680'
    });

    await stageService.unlightStage('S001');

    expect(stageService.getStageNote('S001')).toEqual({
      stageId: 'S001',
      seat: '',
      companions: '',
      note: '',
      actualTicketPrice: 0
    });
  });
});
describe('M3 - stageService 筛选、搜索和统计', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();

    mockStorageService.getCollection.mockImplementation(
      (userId, collectionName) =>
        store[collectionName] || []
    );

    mockStorageService.setCollection.mockImplementation(
      (userId, collectionName, value) => {
        store[collectionName] = value;
      }
    );

    mockExpenseService.listExpenses.mockImplementation(
      () => store.expenses
    );
  });

  test('能够组合舞台类型、年份、关键词和点亮状态筛选', async () => {
    await stageService.unlightStage('S001');
    await stageService.lightStage('S001');

    const result = stageService.filterStages({
      stageType: 'concert',
      year: '2026',
      keyword: '晴天',
      lightStatus: 'lighted'
    });

    expect(result).toHaveLength(1);
    expect(result[0].stageId).toBe('S001');
  });

  test('歌曲搜索合并同名歌曲对应的多个舞台', () => {
    const result = stageService.searchSongs('稻香');

    expect(result).toHaveLength(1);
    expect(result[0].songName).toBe('稻香');

    expect(
      result[0].stages.map((item) => item.stageId)
    ).toEqual(['S001', 'S002']);
  });

  test('见面场次选项包含真实场次和倒计时占位场次', () => {
    const options =
      stageService.getConcertStageOptions();

    expect(
      options.map((item) => item.id)
    ).toEqual([
      'S001',
      'S002',
      'S003',
      'stage_countdown_placeholder'
    ]);

    expect(
      stageService.findStageByDate(
        '2026-07-01',
        'concert'
      )
    ).toEqual(
      expect.objectContaining({
        stageId: 'S001'
      })
    );
  });

  test('点亮舞台后更新点亮状态且占位场次不计入进度', async () => {
    await stageService.unlightStage('S001');

    const result =
      await stageService.lightStage('S001');

    expect(result.valid).toBe(true);

    expect(
      stageService.listStages().find(
        (item) => item.stageId === 'S001'
      ).isLighted
    ).toBe(true);

    expect(stageService.getStageStats()).toEqual(
      expect.objectContaining({
        total: 3,
        lightedCount: 1,
        progressPercent: 33
      })
    );
  });
});
describe('M3 - 舞台与消费记录联动', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    resetStore();

    mockStorageService.getCollection.mockImplementation(
      (userId, collectionName) =>
        store[collectionName] || []
    );

    mockStorageService.setCollection.mockImplementation(
      (userId, collectionName, value) => {
        store[collectionName] = value;
      }
    );

    mockExpenseService.listExpenses.mockImplementation(
      () => store.expenses
    );

    mockExpenseService.removeExpense.mockImplementation(
      (expenseId) => {
        store.expenses = store.expenses.filter(
          (item) => item.expenseId !== expenseId
        );
        return store.expenses;
      }
    );

    await stageService.ensureStagesLoaded();
  });

  test('关联消费记录时自动点亮舞台并保存expenseId', async () => {
    store.expenses = [
      {
        expenseId: 'E001',
        stageId: 'S001',
        seat: 'A区1排'
      }
    ];

    await stageService.ensureStagesLoaded();
    await stageService.linkStageExpense('S001', 'E001');

    const stage = stageService.listStages().find(
      (item) => item.stageId === 'S001'
    );

    expect(stage.isLighted).toBe(true);
    expect(stage.expenseId).toBe('E001');

    expect(stageService.hasStageLinkedExpense('S001'))
      .toBe(true);

    expect(stageService.getLinkedExpense(stage)).toEqual({
      expenseId: 'E001',
      stageId: 'S001',
      seat: 'A区1排'
    });
  });

  test.failing('已知缺陷 DEF-STG-102：清除消费关联后内存状态未同步，列表仍保留旧 expenseId', async () => {
    await stageService.linkStageExpense(
      'S002',
      'E001'
    );

    stageService.clearStageExpenseLink(
      'S002',
      'E999'
    );

    expect(
      stageService.listStages().find(
        (item) => item.stageId === 'S002'
      ).expenseId
    ).toBe('E001');

    stageService.clearStageExpenseLink(
      'S002',
      'E001'
    );

    expect(
      stageService.listStages().find(
        (item) => item.stageId === 'S002'
      ).expenseId
    ).toBe('');
  });

  test('舞台不存在或票价无效时拒绝同步生成消费记录', async () => {
    await expect(
      stageService.createExpenseFromStage(
        'UNKNOWN',
        680
      )
    ).resolves.toEqual({
      valid: false,
      message: '舞台场次不存在'
    });

    await expect(
      stageService.createExpenseFromStage(
        'S001',
        0
      )
    ).resolves.toEqual({
      valid: false,
      message: '请先选择票档或输入有效票价'
    });

    expect(mockExpenseService.addExpense)
      .not.toHaveBeenCalled();
  });

  test('从舞台生成消费记录时传递舞台日期票价并建立关联', async () => {
    mockExpenseService.addExpense.mockImplementation(
      (payload) => {
        const data = {
          ...payload,
          expenseId: 'E100'
        };

        store.expenses = [data];

        return {
          valid: true,
          data
        };
      }
    );

    const result =
      await stageService.createExpenseFromStage(
        'S001',
        680
      );

    expect(result.valid).toBe(true);
    expect(result.data.expenseId).toBe('E100');

    expect(mockExpenseService.addExpense)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'meet',
          subType: 'concert',
          itemName: '上海演唱会',
          amount: 680,
          quantity: 1,
          date: '2026-07-01',
          includeInTotal: true,
          stageId: 'S001',
          stageDate: '2026-07-01',
          priceTier: 680
        })
      );

    expect(
      stageService.listStages().find(
        (item) => item.stageId === 'S001'
      ).expenseId
    ).toBe('E100');
  });

  test('取消点亮时删除关联消费并清空备注', async () => {
    store.expenses = [
      {
        expenseId: 'E200',
        stageId: 'S003',
        seat: 'B区2排'
      }
    ];

    await stageService.ensureStagesLoaded();
    await stageService.linkStageExpense('S003', 'E200');

    await stageService.saveStageNote('S003', {
      seat: 'B区2排',
      companions: '朋友B',
      note: '待清空',
      actualTicketPrice: '380'
    });

    await stageService.unlightStage(
      'S003',
      {
        deleteExpense: true
      }
    );

    expect(mockExpenseService.removeExpense)
      .toHaveBeenCalledWith('E200');

    expect(
      stageService.listStages().find(
        (item) => item.stageId === 'S003'
      )
    ).toEqual(
      expect.objectContaining({
        isLighted: false,
        expenseId: ''
      })
    );

    expect(stageService.getStageNote('S003')).toEqual({
      stageId: 'S003',
      seat: '',
      companions: '',
      note: '',
      actualTicketPrice: 0
    });
  });

  test('舞台仪表盘聚合时间线筛选统计和歌曲搜索结果', async () => {
    await stageService.unlightStage('S001');
    await stageService.lightStage('S001');

    const dashboard = stageService.getStageDashboard({
      keyword: '稻香',
      stageType: 'all',
      year: 'all',
      lightStatus: 'all',
      statsYear: '2026'
    });

    expect(dashboard).toEqual(
      expect.objectContaining({
        meetTimeline: expect.any(Object),
        stages: expect.any(Array),
        stats: expect.any(Object),
        songStats: expect.any(Array),
        albumProgress: expect.any(Array),
        songSearchResults: expect.any(Array),
        yearStats: expect.any(Object),
        statsYearOptions: expect.any(Array)
      })
    );

    expect(dashboard.songSearchResults[0].songName)
      .toBe('稻香');
  });
});

