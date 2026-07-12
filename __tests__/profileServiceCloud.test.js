const mockApiService = {
  request: jest.fn()
};

const mockStorageService = {
  getActiveUserId: jest.fn(),
  readUserData: jest.fn(),
  writeUserData: jest.fn()
};

jest.mock(
  '../services/apiService',
  () => mockApiService
);

jest.mock(
  '../services/storageService',
  () => mockStorageService
);

const profileService =
  require('../services/profileService');

describe('profileService头像昵称云端服务', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockStorageService.getActiveUserId
      .mockReturnValue('wx_user-A');

    mockStorageService.readUserData
      .mockReturnValue({
        expenses: [],
        budgets: [],
        userCollections: [],
        userStages: [],
        stageNotes: [],
        profile: {
          nickname: '旧昵称',
          displayName: '旧昵称',
          avatarFileId: 'cloud://old-avatar',
          loginStatus: true
        }
      });

    global.wx = {
      getFileInfo: jest.fn(),
      cloud: {
        uploadFile: jest.fn(),
        getTempFileURL: jest.fn(),
        deleteFile: jest.fn()
      }
    };
  });

  test('读取云端资料后更新当前用户缓存', async () => {
    mockApiService.request.mockResolvedValue({
      displayName: '云端昵称',
      avatarFileId: 'cloud://avatar-new'
    });

    const result =
      await profileService.getProfile();

    expect(mockApiService.request)
      .toHaveBeenCalledWith({
        url: '/profile'
      });

    expect(result.displayName).toBe('云端昵称');

    expect(mockStorageService.writeUserData)
      .toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          profile: expect.objectContaining({
            nickname: '云端昵称',
            displayName: '云端昵称',
            avatarFileId: 'cloud://avatar-new',
            loginStatus: true
          })
        })
      );
  });

  test('保存资料使用PUT并更新本地缓存', async () => {
    mockApiService.request.mockResolvedValue({
      displayName: '新昵称',
      avatarFileId: 'cloud://avatar-new'
    });

    const result =
      await profileService.saveProfile({
        displayName: '新昵称'
      });

    expect(mockApiService.request)
      .toHaveBeenCalledWith({
        url: '/profile',
        method: 'PUT',
        data: {
          displayName: '新昵称'
        }
      });

    expect(result.displayName).toBe('新昵称');

    expect(mockStorageService.writeUserData)
      .toHaveBeenCalled();
  });

  test('超过2MB头像被拒绝且不上传', async () => {
    wx.getFileInfo.mockImplementation(
      (options) => {
        options.success({
          size: 2 * 1024 * 1024 + 1
        });
      }
    );

    await expect(
      profileService.uploadAvatar(
        '/tmp/avatar.jpg'
      )
    ).rejects.toThrow(
      '头像图片不能超过2MB'
    );

    expect(wx.cloud.uploadFile)
      .not.toHaveBeenCalled();
  });

  test('合法头像上传路径包含当前用户ID', async () => {
    mockStorageService.getActiveUserId
      .mockReturnValue('wx_user!A-1');

    wx.getFileInfo.mockImplementation(
      (options) => {
        options.success({
          size: 1024
        });
      }
    );

    wx.cloud.uploadFile.mockImplementation(
      (options) => {
        options.success({
          fileID: 'cloud://new-avatar'
        });
      }
    );

    await expect(
      profileService.uploadAvatar(
        '/tmp/avatar.png'
      )
    ).resolves.toBe(
      'cloud://new-avatar'
    );

    expect(wx.cloud.uploadFile)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: '/tmp/avatar.png',
          cloudPath: expect.stringMatching(
            /^avatars\/wx_userA-1\/.+\.png$/
          )
        })
      );
  });

  test('头像上传未返回fileID时明确报错', async () => {
    wx.getFileInfo.mockImplementation(
      (options) => {
        options.success({
          size: 1024
        });
      }
    );

    wx.cloud.uploadFile.mockImplementation(
      (options) => {
        options.success({});
      }
    );

    await expect(
      profileService.uploadAvatar(
        '/tmp/avatar.jpg'
      )
    ).rejects.toThrow(
      '头像上传未返回文件标识'
    );
  });

  test('头像临时链接能够正确解析', async () => {
    wx.cloud.getTempFileURL.mockImplementation(
      (options) => {
        options.success({
          fileList: [{
            status: 0,
            tempFileURL:
              'https://example.com/avatar.jpg'
          }]
        });
      }
    );

    await expect(
      profileService.getTempFileUrl(
        'cloud://avatar'
      )
    ).resolves.toBe(
      'https://example.com/avatar.jpg'
    );
  });

  test('旧头像删除失败不阻断主流程', async () => {
    wx.cloud.deleteFile.mockImplementation(
      (options) => {
        options.fail({
          errMsg: 'delete failed'
        });
      }
    );

    await expect(
      profileService.deleteFile(
        'cloud://old-avatar'
      )
    ).resolves.toBeUndefined();
  });
});
