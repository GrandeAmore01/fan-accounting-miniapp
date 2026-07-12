const mockExpenseService = {
  expenseCategories: [
    {
      id: 'meet',
      name: '见面',
      subTypes: [
        { id: 'concert', name: '演唱会' },
        { id: 'new_year_concert', name: '新年音乐会' },
        { id: 'sports_day', name: '运动会' }
      ]
    },
    {
      id: 'collection',
      name: '藏品',
      subTypes: [{ id: 'goods', name: '周边' }]
    },
    {
      id: 'accommodation',
      name: '住宿',
      subTypes: [{ id: 'hotel', name: '酒店/住宿' }]
    },
    {
      id: 'transport',
      name: '交通',
      subTypes: [{ id: 'travel', name: '交通出行' }]
    },
    {
      id: 'other',
      name: '其他',
      subTypes: [{ id: 'other', name: '其他消费' }]
    }
  ],

  getSubType: jest.fn((category, subType) => {
    const main =
      mockExpenseService.expenseCategories.find(
        (item) => item.id === category
      );

    return main
      ? main.subTypes.find(
          (item) => item.id === subType
        )
      : null;
  }),

  formatMoney: jest.fn(
    (value) => Number(value || 0).toFixed(2)
  )
};

const mockBudgetService = {
  getBudgetProgress: jest.fn(() => ({
    percent: 0
  }))
};

const mockCollectionCatalogService = {};

jest.mock(
  '../services/expenseService',
  () => mockExpenseService
);

jest.mock(
  '../services/budgetService',
  () => mockBudgetService
);

jest.mock(
  '../services/collectionCatalogService',
  () => mockCollectionCatalogService
);

let pageDefinition;

function setPath(target, path, value) {
  const parts = path.split('.');
  let current = target;

  for (let i = 0; i < parts.length - 1; i += 1) {
    if (
      !current[parts[i]] ||
      typeof current[parts[i]] !== 'object'
    ) {
      current[parts[i]] = {};
    }

    current = current[parts[i]];
  }

  current[parts[parts.length - 1]] = value;
}

function createPage() {
  const page = {
    ...pageDefinition,
    data: JSON.parse(
      JSON.stringify(pageDefinition.data)
    )
  };

  page.setData = function setData(patch, callback) {
    Object.entries(patch).forEach(([key, value]) => {
      setPath(this.data, key, value);
    });

    if (typeof callback === 'function') {
      callback();
    }
  };

  return page;
}

describe('消费页面表单边界与日期联动', () => {
  beforeAll(() => {
    global.Page = jest.fn((definition) => {
      pageDefinition = definition;
    });

    global.wx = {
      ...(global.wx || {}),
      showToast: jest.fn(),
      showModal: jest.fn(),
      showLoading: jest.fn(),
      hideLoading: jest.fn(),
      getStorageSync: jest.fn(),
      setStorageSync: jest.fn(),
      removeStorageSync: jest.fn()
    };

    require('../pages/expenses/index.js');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('已知缺陷 DEF-EXP-103：官方见面消费重新选择未匹配日期时不应清空金额',
    () => {
      const page = createPage();

      page.data.meetStages = [];
      page.data.matchedMeetStageName = '';

      page.data.formData = {
        ...page.data.formData,
        category: 'meet',
        subType: 'concert',
        purchaseChannel: 'official',
        amount: '580',
        itemName: '演唱会',
        stageId: '',
        stageDate: '2026-07-12',
        priceTier: '',
        city: '',
        location: ''
      };

      page.handleMeetDateChange({
        detail: {
          value: '2026-07-12'
        }
      });

      expect(page.data.formData.amount)
        .toBe('580');
    }
  );

  test('非官方见面消费选择日期时保留金额', () => {
    const page = createPage();

    page.data.meetStages = [];

    page.data.formData = {
      ...page.data.formData,
      category: 'meet',
      subType: 'concert',
      purchaseChannel: 'other',
      amount: '580',
      itemName: '演唱会',
      stageId: '',
      priceTier: '',
      city: '',
      location: ''
    };

    page.handleMeetDateChange({
      detail: {
        value: '2026-07-13'
      }
    });

    expect(page.data.formData.amount)
      .toBe('580');

    expect(page.data.formData.stageDate)
      .toBe('2026-07-13');
  });

  test('非见面分类修改日期时保留金额', () => {
    const page = createPage();

    page.data.formData = {
      ...page.data.formData,
      category: 'accommodation',
      amount: '300',
      date: '2026-07-12'
    };

    page.handleDateChange({
      detail: {
        value: '2026-07-13'
      }
    });

    expect(page.data.formData.amount)
      .toBe('300');

    expect(page.data.formData.date)
      .toBe('2026-07-13');
  });

  test('项目名称80字允许，81字时保留原值并提示', () => {
    const page = createPage();

    page.data.formData.itemName = '原项目名';

    expect(
      page.sanitizeFormInput(
        'itemName',
        '名'.repeat(80)
      )
    ).toBe('名'.repeat(80));

    expect(
      page.sanitizeFormInput(
        'itemName',
        '名'.repeat(81)
      )
    ).toBe('原项目名');

    expect(wx.showToast)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          title: '项目名称上限为 80 个字'
        })
      );
  });

  test('备注160字允许，161字时保留原值并提示', () => {
    const page = createPage();

    page.data.formData.remark = '原备注';

    expect(
      page.sanitizeFormInput(
        'remark',
        '备'.repeat(160)
      )
    ).toBe('备'.repeat(160));

    expect(
      page.sanitizeFormInput(
        'remark',
        '备'.repeat(161)
      )
    ).toBe('原备注');

    expect(wx.showToast)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          title: '备注上限为 160 个字'
        })
      );
  });

  test('金额最多允许两位小数', () => {
    const page = createPage();

    expect(
      page.sanitizeAmountInput(
        '580.12',
        '580'
      )
    ).toBe('580.12');

    expect(
      page.sanitizeAmountInput(
        '580.123',
        '580.12'
      )
    ).toBe('580.12');

    expect(wx.showToast)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          title: '金额最多保留 2 位小数'
        })
      );
  });

  test('金额1000000允许，超过上限时保留原值', () => {
    const page = createPage();

    expect(
      page.sanitizeAmountInput(
        '1000000',
        '580'
      )
    ).toBe('1000000');

    expect(
      page.sanitizeAmountInput(
        '1000000.01',
        '580'
      )
    ).toBe('580');

    expect(wx.showToast)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          title: '金额上限为 1000000'
        })
      );
  });

  test('清空金额输入时允许返回空字符串', () => {
    const page = createPage();

    expect(
      page.sanitizeAmountInput('', '580')
    ).toBe('');
  });
});
