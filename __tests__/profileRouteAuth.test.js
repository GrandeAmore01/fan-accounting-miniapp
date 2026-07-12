const mockRoutes = {
  get: {},
  put: {}
};

const mockRouter = {
  get: jest.fn((path, handler) => {
    mockRoutes.get[path] = handler;
  }),

  put: jest.fn((path, handler) => {
    mockRoutes.put[path] = handler;
  })
};

const mockPool = {
  execute: jest.fn()
};

jest.mock(
  'express',
  () => ({
    Router: () => mockRouter
  }),
  { virtual: true }
);

jest.mock(
  '../server/src/db',
  () => mockPool
);

require('../server/src/routes/profile');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

describe('个人资料路由用户隔离与校验', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('查询资料只使用令牌用户身份', async () => {
    mockPool.execute.mockResolvedValue([
      [{
        display_name: '用户A',
        avatar_file_id: 'cloud://avatar-A'
      }]
    ]);

    const req = {
      auth: {
        userId: 'user-A'
      },
      query: {
        userId: 'user-B'
      }
    };

    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.get['/'](
      req,
      res,
      next
    );

    expect(mockPool.execute)
      .toHaveBeenCalledWith(
        expect.stringContaining(
          'WHERE user_id = ?'
        ),
        ['user-A']
      );

    expect(res.json)
      .toHaveBeenCalledWith({
        ok: true,
        data: {
          displayName: '用户A',
          avatarFileId: 'cloud://avatar-A'
        }
      });
  });

  test('修改昵称忽略客户端伪造userId', async () => {
    mockPool.execute
      .mockResolvedValueOnce([
        { affectedRows: 1 }
      ])
      .mockResolvedValueOnce([
        [{
          display_name: '新昵称',
          avatar_file_id: ''
        }]
      ]);

    const req = {
      auth: {
        userId: 'user-A'
      },
      body: {
        userId: 'user-B',
        displayName: '新昵称'
      }
    };

    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.put['/'](
      req,
      res,
      next
    );

    expect(mockPool.execute)
      .toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(
          'UPDATE users SET'
        ),
        ['新昵称', 'user-A']
      );

    expect(next).not.toHaveBeenCalled();
  });

  test('昵称超过20个字符时拒绝保存', async () => {
    const req = {
      auth: {
        userId: 'user-A'
      },
      body: {
        displayName: '名'.repeat(21)
      }
    };

    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.put['/'](
      req,
      res,
      next
    );

    expect(mockPool.execute)
      .not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        message: '昵称不能超过20个字符'
      })
    );
  });

  test('非法头像文件标识被拒绝', async () => {
    const req = {
      auth: {
        userId: 'user-A'
      },
      body: {
        avatarFileId:
          'https://example.com/avatar.jpg'
      }
    };

    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.put['/'](
      req,
      res,
      next
    );

    expect(mockPool.execute)
      .not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        message: '头像文件标识不正确'
      })
    );
  });

  test('合法头像只保存到当前登录用户', async () => {
    mockPool.execute
      .mockResolvedValueOnce([
        { affectedRows: 1 }
      ])
      .mockResolvedValueOnce([
        [{
          display_name: '用户A',
          avatar_file_id:
            'cloud://test/avatar-A'
        }]
      ]);

    const req = {
      auth: {
        userId: 'user-A'
      },
      body: {
        userId: 'user-B',
        avatarFileId:
          'cloud://test/avatar-A'
      }
    };

    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.put['/'](
      req,
      res,
      next
    );

    expect(mockPool.execute)
      .toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(
          'UPDATE users SET'
        ),
        [
          'cloud://test/avatar-A',
          'user-A'
        ]
      );

    expect(res.json)
      .toHaveBeenCalledWith({
        ok: true,
        data: {
          displayName: '用户A',
          avatarFileId:
            'cloud://test/avatar-A'
        }
      });
  });
});
