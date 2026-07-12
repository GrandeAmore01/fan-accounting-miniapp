describe('认证与云托管请求回归', () => {
  let request;
  let mockSetActiveUser;

  beforeEach(() => {
    jest.resetModules();

    mockSetActiveUser = jest.fn();

    jest.doMock('../services/config', () => ({
      CLOUD_ENV_ID: 'test-env'
    }));

    jest.doMock('../services/storageService', () => ({
      setActiveUser: mockSetActiveUser
    }));

    global.wx = {
      getStorageSync: jest.fn(),
      setStorageSync: jest.fn(),
      removeStorageSync: jest.fn(),
      login: jest.fn(),
      cloud: {
        callContainer: jest.fn()
      }
    };

    request = require('../utils/request');
  });

  afterEach(() => {
    delete global.wx;
    jest.clearAllMocks();
  });

  test('已有令牌时直接携带令牌发送请求', async () => {
    wx.getStorageSync.mockReturnValue('saved-token');

    wx.cloud.callContainer.mockImplementation((options) => {
      options.success({
        statusCode: 200,
        data: {
          ok: true,
          data: { result: 'success' }
        }
      });
    });

    await expect(
      request({
        path: '/api/test',
        method: 'GET'
      })
    ).resolves.toEqual({
      result: 'success'
    });

    expect(wx.login).not.toHaveBeenCalled();

    expect(wx.cloud.callContainer)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/test',
          header: expect.objectContaining({
            Authorization: 'Bearer saved-token'
          })
        })
      );
  });

  test('无令牌时完成静默登录并保存用户身份', async () => {
    wx.getStorageSync.mockReturnValue('');

    wx.login.mockImplementation((options) => {
      options.success({ code: 'wx-code-001' });
    });

    wx.cloud.callContainer.mockImplementation((options) => {
      if (options.path === '/api/auth/login') {
        options.success({
          statusCode: 200,
          data: {
            ok: true,
            data: {
              token: 'new-token',
              userId: 'USER001'
            }
          }
        });
        return;
      }

      options.success({
        statusCode: 200,
        data: {
          ok: true,
          data: { loaded: true }
        }
      });
    });

    await expect(
      request({
        path: '/api/expenses'
      })
    ).resolves.toEqual({
      loaded: true
    });

    expect(wx.setStorageSync)
      .toHaveBeenCalledWith(
        'fan_accounting_auth_token',
        'new-token'
      );

    expect(mockSetActiveUser)
      .toHaveBeenCalledWith('USER001');
  });

  test('收到401后清除旧令牌并重新登录重试', async () => {
    wx.getStorageSync.mockReturnValue('expired-token');

    wx.login.mockImplementation((options) => {
      options.success({ code: 'new-code' });
    });

    wx.cloud.callContainer
      .mockImplementationOnce((options) => {
        options.success({
          statusCode: 401,
          data: {
            ok: false,
            message: '未授权'
          }
        });
      })
      .mockImplementationOnce((options) => {
        options.success({
          statusCode: 200,
          data: {
            ok: true,
            data: {
              token: 'refreshed-token',
              userId: 'USER002'
            }
          }
        });
      })
      .mockImplementationOnce((options) => {
        options.success({
          statusCode: 200,
          data: {
            ok: true,
            data: { retried: true }
          }
        });
      });

    await expect(
      request({
        path: '/api/budgets'
      })
    ).resolves.toEqual({
      retried: true
    });

    expect(wx.removeStorageSync)
      .toHaveBeenCalledWith(
        'fan_accounting_auth_token'
      );

    expect(wx.cloud.callContainer)
      .toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          header: expect.objectContaining({
            Authorization: 'Bearer refreshed-token'
          })
        })
      );
  });

  test('微信登录未返回code时给出明确错误', async () => {
    wx.getStorageSync.mockReturnValue('');

    wx.login.mockImplementation((options) => {
      options.success({ code: '' });
    });

    await expect(
      request({
        path: '/api/expenses'
      })
    ).rejects.toThrow(
      '微信登录未返回 code'
    );
  });

  test('云托管失败时返回errMsg', async () => {
    wx.getStorageSync.mockReturnValue('saved-token');

    wx.cloud.callContainer.mockImplementation((options) => {
      options.fail({
        errMsg: 'callContainer:fail timeout'
      });
    });

    await expect(
      request({
        path: '/api/collections'
      })
    ).rejects.toThrow(
      'callContainer:fail timeout'
    );
  });

  test('业务响应ok=false时返回服务端错误', async () => {
    wx.getStorageSync.mockReturnValue('saved-token');

    wx.cloud.callContainer.mockImplementation((options) => {
      options.success({
        statusCode: 200,
        data: {
          ok: false,
          message: '数据不存在'
        }
      });
    });

    await expect(
      request({
        path: '/api/test'
      })
    ).rejects.toThrow(
      '数据不存在'
    );
  });

  test('clearToken能够删除本地登录令牌', () => {
    request.clearToken();

    expect(wx.removeStorageSync)
      .toHaveBeenCalledWith(
        'fan_accounting_auth_token'
      );
  });
});
