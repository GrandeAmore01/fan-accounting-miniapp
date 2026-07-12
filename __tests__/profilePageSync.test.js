const mockStorageService = {
  getLocalDataSummary: jest.fn(),
  getCollection: jest.fn(),
  resetUserData: jest.fn()
};

const mockExpenseService = {
  getExpenseSummary: jest.fn()
};

const mockBudgetService = {
  getCurrentMonth: jest.fn(
    () => '2026-07'
  ),

  getBudgetDashboardAsync: jest.fn()
};

const mockCollectionService = {
  listCollections: jest.fn()
};

const mockStageService = {
  ensureStagesLoaded: jest.fn(),
  getStageStats: jest.fn()
};

const mockProfileService = {
  getProfile: jest.fn(),
  saveProfile: jest.fn(),
  uploadAvatar: jest.fn(),
  getTempFileUrl: jest.fn(),
  deleteFile: jest.fn()
};

jest.mock(
  '../services/storageService',
  () => mockStorageService
);

jest.mock(
  '../services/expenseService',
  () => mockExpenseService
);

jest.mock(
  '../services/budgetService',
  () => mockBudgetService
);

jest.mock(
  '../services/collectionService',
  () => mockCollectionService
);

jest.mock(
  '../services/stageService',
  () => mockStageService
);

jest.mock(
  '../services/profileService',
  () => mockProfileService
);

let pageDefinition;

function setPath(target, path, value) {
  const parts = path.split('.');
  let current = target;

  for (
    let index = 0;
    index < parts.length - 1;
    index += 1
  ) {
    current[parts[index]] =
      current[parts[index]] || {};

    current = current[parts[index]];
  }

  current[
    parts[parts.length - 1]
  ] = value;
}

function createPage() {
  const page = {
    ...pageDefinition,

    data: JSON.parse(
      JSON.stringify(pageDefinition.data)
    )
  };

  page.setData = function setData(
    patch,
    callback
  ) {
    Object.entries(patch).forEach(
      ([key, value]) => {
        setPath(
          this.data,
          key,
          value
        );
      }
    );

    if (typeof callback === 'function') {
      callback();
    }
  };

  return page;
}

function cachedSummary() {
  return {
    profile: {
      nickname: '缓存昵称',
      displayName: '缓存昵称',
      avatarFileId:
        'cloud://cached-avatar',
      loginStatus: true
    },

    counts: {
      expenses: 2,
      budgets: 1,
      userCollections: 2,
      lightedCollections: 1,
      userStages: 2,
      lightedStages: 1
    },

    hasLocalData: true
  };
}

describe('我的页面同步与头像更新', () => {
  beforeAll(() => {
    global.Page = jest.fn(
      (definition) => {
        pageDefinition = definition;
      }
    );

    global.wx = {
      showToast: jest.fn(),
      showLoading: jest.fn(),
      hideLoading: jest.fn(),
      showModal: jest.fn(),
      switchTab: jest.fn()
    };

    require('../pages/profile/index.js');
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockStorageService
      .getLocalDataSummary
      .mockReturnValue(
        cachedSummary()
      );

    mockStorageService
      .getCollection
      .mockReturnValue([
        {
          includedAmount: 20
        },
        {
          includedAmount: 30
        }
      ]);

    mockExpenseService
      .getExpenseSummary
      .mockReturnValue({
        count: 3,
        totalAmount: 88.8
      });

    mockBudgetService
      .getBudgetDashboardAsync
      .mockResolvedValue({
        progress: {
          budget: {
            amount: 1000
          },
          totalAmount: 200,
          remainingAmount: 800,
          percent: 20,
          isOverBudget: false
        }
      });

    mockCollectionService
      .listCollections
      .mockResolvedValue([
        {
          isOwned: true
        },
        {
          isOwned: false
        }
      ]);

    mockStageService
      .ensureStagesLoaded
      .mockResolvedValue();

    mockStageService
      .getStageStats
      .mockReturnValue({
        lightedCount: 2
      });

    mockProfileService
      .getProfile
      .mockResolvedValue({
        displayName: '云端昵称',
        avatarFileId:
          'cloud://cloud-avatar'
      });

    mockProfileService
      .getTempFileUrl
      .mockResolvedValue(
        'https://example.com/avatar.jpg'
      );
  });

  test('云端数据加载成功后显示已同步', async () => {
    const page = createPage();

    await page.refreshPage();

    expect(page.data.loading).toBe(false);
    expect(page.data.sync.state)
      .toBe('synced');
    expect(page.data.sync.label)
      .toBe('已同步');

    expect(page.data.profile)
      .toEqual(
        expect.objectContaining({
          nickname: '云端昵称',
          avatarFileId:
            'cloud://cloud-avatar',
          avatarUrl:
            'https://example.com/avatar.jpg',
          loginStatus: true
        })
      );

    expect(page.data.overview)
      .toEqual({
        expenseCount: 3,
        totalAmountText: '88.80',
        collectionCount: 1,
        stageCount: 2
      });
  });

  test('云端失败后显示缓存和暂时离线', async () => {
    mockBudgetService
      .getBudgetDashboardAsync
      .mockRejectedValue(
        new Error('network failed')
      );

    const page = createPage();

    await page.refreshPage();

    expect(page.data.loading).toBe(false);
    expect(page.data.sync.state)
      .toBe('offline');
    expect(page.data.sync.label)
      .toBe('暂时离线');

    expect(page.data.profile.nickname)
      .toBe('缓存昵称');

    expect(page.data.overview)
      .toEqual({
        expenseCount: 2,
        totalAmountText: '50.00',
        collectionCount: 1,
        stageCount: 1
      });
  });

  test('头像更新成功后删除旧头像', async () => {
    const page = createPage();

    page.data.profile = {
      nickname: '用户A',
      avatarFileId:
        'cloud://old-avatar',
      avatarUrl: 'old-url',
      loginStatus: true
    };

    mockProfileService.uploadAvatar
      .mockResolvedValue(
        'cloud://new-avatar'
      );

    mockProfileService.saveProfile
      .mockResolvedValue({
        displayName: '用户A',
        avatarFileId:
          'cloud://new-avatar'
      });

    mockProfileService.getTempFileUrl
      .mockResolvedValue('new-url');

    await page.handleChooseAvatar({
      detail: {
        avatarUrl: '/tmp/new.jpg'
      }
    });

    expect(page.data.profile.avatarFileId)
      .toBe('cloud://new-avatar');

    expect(page.data.profile.avatarUrl)
      .toBe('new-url');

    expect(mockProfileService.deleteFile)
      .toHaveBeenCalledWith(
        'cloud://old-avatar'
      );

    expect(wx.showToast)
      .toHaveBeenCalledWith({
        title: '头像已更新',
        icon: 'success'
      });
  });

  test('资料保存失败时删除新上传文件且保留旧头像', async () => {
    const page = createPage();

    page.data.profile = {
      nickname: '用户A',
      avatarFileId:
        'cloud://old-avatar',
      avatarUrl: 'old-url',
      loginStatus: true
    };

    mockProfileService.uploadAvatar
      .mockResolvedValue(
        'cloud://failed-avatar'
      );

    mockProfileService.saveProfile
      .mockRejectedValue(
        new Error('保存失败')
      );

    await page.handleChooseAvatar({
      detail: {
        avatarUrl: '/tmp/new.jpg'
      }
    });

    expect(mockProfileService.deleteFile)
      .toHaveBeenCalledWith(
        'cloud://failed-avatar'
      );

    expect(page.data.profile.avatarFileId)
      .toBe('cloud://old-avatar');

    expect(page.data.profile.avatarUrl)
      .toBe('old-url');

    expect(wx.showToast)
      .toHaveBeenCalledWith({
        title: '保存失败',
        icon: 'none'
      });
  });
});
