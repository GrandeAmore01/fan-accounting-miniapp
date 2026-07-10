jest.mock('../services/collectionService', () => ({
  listCollections: jest.fn(),
  lightCollection: jest.fn(),
  unlightCollection: jest.fn()
}));

let pageDefinition;

global.Page = jest.fn((definition) => {
  pageDefinition = definition;
});

require('../pages/collections/index');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setByPath(target, path, value) {
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.');

  let current = target;

  for (let index = 0; index < parts.length - 1; index += 1) {
    current = current[parts[index]];
  }

  current[parts[parts.length - 1]] = value;
}

function createPage(overrides = {}) {
  const page = {
    ...pageDefinition,
    data: {
      ...clone(pageDefinition.data),
      ...(overrides.data || {})
    }
  };

  page.setData = jest.fn((updates) => {
    Object.entries(updates).forEach(([path, value]) => {
      setByPath(page.data, path, value);
    });
  });

  return page;
}

const sampleCollections = [
  {
    collectionId: 'C001',
    collectionName: '商务徽章',
    seriesName: '第一系列',
    saleType: '预售',
    primaryCategory: '商务',
    secondaryCategory: '徽章',
    productStyle: '单人款',
    isOwned: true
  },
  {
    collectionId: 'C002',
    collectionName: '商务卡片',
    seriesName: '第二系列',
    saleType: '现货',
    primaryCategory: '商务',
    secondaryCategory: '卡片',
    productStyle: '普通款',
    isOwned: false
  },
  {
    collectionId: 'C003',
    collectionName: '演出纪念套装',
    seriesName: '周年系列',
    saleType: '限定',
    primaryCategory: '演出',
    secondaryCategory: '未分类',
    productStyle: '套装款',
    isOwned: true
  }
];

describe('M2 - 藏品图鉴页面核心逻辑', () => {
  test('unique 去除重复值和空值并保持原顺序', () => {
    const page = createPage();

    expect(
      page.unique(['商务', '', '商务', null, '演出', '演出'])
    ).toEqual(['商务', '演出']);
  });

  test('款式选项按照预设顺序排列并保留额外款式', () => {
    const page = createPage();

    const result = page.buildStyleOptions([
      { productStyle: '普通款' },
      { productStyle: '自定义款' },
      { productStyle: '单人款' },
      { productStyle: '套装款' },
      { productStyle: '普通款' }
    ]);

    expect(result).toEqual([
      '全部',
      '单人款',
      '套装款',
      '普通款',
      '自定义款'
    ]);
  });

  test('长名称正确标记并生成跑马灯时长', () => {
    const page = createPage();

    expect(page.getNameDisplay('短名称')).toEqual({
      isLongName: false,
      marqueeDuration: 9
    });

    const longResult =
      page.getNameDisplay('这是一个非常非常长的藏品名称');

    expect(longResult.isLongName).toBe(true);
    expect(longResult.marqueeDuration).toBeGreaterThan(9);
  });

  test('按大类、二级分类、款式、状态和关键词组合筛选', () => {
    const page = createPage({
      data: {
        allCollections: clone(sampleCollections),
        groups: [],
        appliedFilters: {
          primary: '商务',
          secondary: '徽章',
          style: '单人款',
          status: '已点亮',
          keyword: '第一'
        }
      }
    });

    page.applyFilters();

    expect(page.data.groups).toHaveLength(1);
    expect(page.data.groups[0].name).toBe('商务');
    expect(page.data.groups[0].count).toBe(1);
    expect(page.data.groups[0].children[0].items[0].collectionId)
      .toBe('C001');

    expect(page.data.progress).toEqual({
      total: 3,
      ownedCount: 2,
      percent: 67
    });
  });

  test('分组时生成大类、二级分类及数量', () => {
    const page = createPage({
      data: {
        groups: []
      }
    });

    const groups = page.buildGroups(clone(sampleCollections));

    expect(groups).toHaveLength(2);

    expect(groups[0]).toEqual(
      expect.objectContaining({
        name: '商务',
        count: 2,
        expanded: true,
        hasSecondaryLevel: true
      })
    );

    expect(groups[0].children).toHaveLength(2);
    expect(groups[1].name).toBe('演出');
    expect(groups[1].hasSecondaryLevel).toBe(false);
  });

  test('重新分组时保留原有展开和折叠状态', () => {
    const page = createPage({
      data: {
        groups: [
          {
            name: '商务',
            expanded: false,
            children: [
              {
                name: '徽章',
                expanded: false,
                items: []
              }
            ]
          }
        ]
      }
    });

    const groups = page.buildGroups([
      sampleCollections[0]
    ]);

    expect(groups[0].expanded).toBe(false);
    expect(groups[0].children[0].expanded).toBe(false);
  });

  test('切换一级分类后更新二级分类和款式选项', () => {
    const page = createPage({
      data: {
        allCollections: clone(sampleCollections),
        primaryOptions: ['全部', '商务', '演出'],
        primaryIndex: 0,
        secondaryOptions: ['全部'],
        secondaryIndex: 0,
        styleOptions: ['全部'],
        styleIndex: 0
      }
    });

    page.handlePrimaryChange({
      detail: {
        value: '1'
      }
    });

    expect(page.data.primaryIndex).toBe(1);
    expect(page.data.secondaryOptions).toEqual([
      '全部',
      '徽章',
      '卡片'
    ]);
    expect(page.data.styleOptions).toEqual([
      '全部',
      '单人款',
      '普通款'
    ]);
    expect(page.data.secondaryIndex).toBe(0);
    expect(page.data.styleIndex).toBe(0);
  });

  test('更新点亮状态后重新计算进度和分组', () => {
    const page = createPage({
      data: {
        allCollections: clone(sampleCollections),
        groups: [],
        appliedFilters: {
          primary: '全部',
          secondary: '全部',
          style: '全部',
          status: '全部',
          keyword: ''
        }
      }
    });

    page.updateOwned('C002', true);

    const updated = page.data.allCollections.find(
      (item) => item.collectionId === 'C002'
    );

    expect(updated.isOwned).toBe(true);
    expect(page.data.progress).toEqual({
      total: 3,
      ownedCount: 3,
      percent: 100
    });
  });

  test('图片加载失败时仅标记对应藏品', () => {
    const page = createPage({
      data: {
        allCollections: clone(sampleCollections).map((item) => ({
          ...item,
          imageFailed: false
        })),
        groups: [],
        appliedFilters: {
          primary: '全部',
          secondary: '全部',
          style: '全部',
          status: '全部',
          keyword: ''
        }
      }
    });

    page.handleImageError({
      currentTarget: {
        dataset: {
          id: 'C002'
        }
      }
    });

    expect(
      page.data.allCollections.find(
        (item) => item.collectionId === 'C002'
      ).imageFailed
    ).toBe(true);

    expect(
      page.data.allCollections.find(
        (item) => item.collectionId === 'C001'
      ).imageFailed
    ).toBe(false);
  });
});

afterAll(() => {
  delete global.Page;
});
