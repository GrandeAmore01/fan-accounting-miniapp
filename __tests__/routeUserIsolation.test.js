process.env.AUTH_TOKEN_SECRET =
  'test-auth-secret-at-least-32-characters-long';

const {
  createToken,
  requireAuth
} = require('../server/src/utils/auth');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

function authenticate(userId, options = {}) {
  const req = {
    query: {
      userId: 'forged-query-user',
      ...(options.query || {})
    },
    body: {
      userId: 'forged-body-user',
      ...(options.body || {})
    },
    params: {
      ...(options.params || {})
    },
    get: jest.fn((name) => (
      String(name).toLowerCase() === 'authorization'
        ? `Bearer ${createToken(userId)}`
        : ''
    ))
  };

  const res = createResponse();
  const next = jest.fn();

  requireAuth(req, res, next);

  expect(next).toHaveBeenCalledTimes(1);
  expect(req.query.userId).toBe(userId);
  expect(req.body.userId).toBe(userId);

  return req;
}

function loadRoute(modulePath) {
  jest.resetModules();

  const handlers = {
    get: {},
    post: {},
    put: {},
    delete: {}
  };

  const router = {
    get: jest.fn((path, handler) => {
      handlers.get[path] = handler;
    }),

    post: jest.fn((path, handler) => {
      handlers.post[path] = handler;
    }),

    put: jest.fn((path, handler) => {
      handlers.put[path] = handler;
    }),

    delete: jest.fn((path, handler) => {
      handlers.delete[path] = handler;
    })
  };

  const pool = {
    execute: jest.fn(),
    getConnection: jest.fn()
  };

  jest.doMock(
    'express',
    () => ({
      Router: () => router
    }),
    { virtual: true }
  );

  jest.doMock(
    '../server/src/db',
    () => pool
  );

  jest.isolateModules(() => {
    require(modulePath);
  });

  return {
    handlers,
    pool
  };
}

describe('业务路由用户身份隔离', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('消费查询忽略伪造userId并使用令牌用户', async () => {
    const { handlers, pool } =
      loadRoute('../server/src/routes/expenses');

    pool.execute.mockResolvedValue([[]]);

    const req = authenticate('user-A');
    const res = createResponse();
    const next = jest.fn();

    await handlers.get['/'](req, res, next);

    expect(pool.execute)
      .toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = ?'),
        ['user-A']
      );

    expect(next).not.toHaveBeenCalled();
  });

  test('藏品查询只读取令牌用户的点亮数据', async () => {
    const { handlers, pool } =
      loadRoute(
        '../server/src/routes/userCollections'
      );

    pool.execute.mockResolvedValue([[]]);

    const req = authenticate('user-A');
    const res = createResponse();
    const next = jest.fn();

    await handlers.get['/'](req, res, next);

    expect(pool.execute)
      .toHaveBeenCalledWith(
        expect.stringContaining(
          'AND uc.user_id = ?'
        ),
        ['user-A']
      );

    expect(next).not.toHaveBeenCalled();
  });

  test('点亮藏品时忽略请求体中的伪造用户', async () => {
    const { handlers, pool } =
      loadRoute(
        '../server/src/routes/userCollections'
      );

    pool.execute
      .mockResolvedValueOnce([
        [{ collection_id: 'C001' }]
      ])
      .mockResolvedValueOnce([
        { affectedRows: 1 }
      ]);

    const req = authenticate('user-A', {
      body: {
        collectionId: 'C001'
      }
    });

    const res = createResponse();
    const next = jest.fn();

    await handlers.post['/light'](
      req,
      res,
      next
    );

    expect(pool.execute)
      .toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(
          'INSERT INTO user_collections'
        ),
        ['user-A', 'C001']
      );

    expect(res.json)
      .toHaveBeenCalledWith({
        ok: true,
        data: {
          userId: 'user-A',
          collectionId: 'C001',
          isOwned: true
        }
      });
  });

  test('点亮舞台时忽略请求体中的伪造用户', async () => {
    const { handlers, pool } =
      loadRoute('../server/src/routes/userStages');

    pool.execute
      .mockResolvedValueOnce([
        [{ stage_id: 'S001' }]
      ])
      .mockResolvedValueOnce([
        { affectedRows: 1 }
      ]);

    const req = authenticate('user-A', {
      body: {
        stageId: 'S001',
        actualTicketPrice: 680
      }
    });

    const res = createResponse();
    const next = jest.fn();

    await handlers.post['/light'](
      req,
      res,
      next
    );

    expect(pool.execute)
      .toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(
          'INSERT INTO user_stages'
        ),
        [
          'user-A',
          'S001',
          680,
          680,
          680
        ]
      );

    expect(next).not.toHaveBeenCalled();
  });

  test('舞台备注查询只读取令牌用户数据', async () => {
    const { handlers, pool } =
      loadRoute('../server/src/routes/stageNotes');

    pool.execute.mockResolvedValue([[]]);

    const req = authenticate('user-A');
    const res = createResponse();
    const next = jest.fn();

    await handlers.get['/'](req, res, next);

    expect(pool.execute)
      .toHaveBeenCalledWith(
        expect.stringContaining(
          'WHERE user_id = ?'
        ),
        ['user-A']
      );

    expect(next).not.toHaveBeenCalled();
  });

  test('保存舞台备注时忽略伪造用户身份', async () => {
    const { handlers, pool } =
      loadRoute('../server/src/routes/stageNotes');

    pool.execute
      .mockResolvedValueOnce([
        [{ stage_id: 'S001' }]
      ])
      .mockResolvedValueOnce([
        { affectedRows: 1 }
      ]);

    const req = authenticate('user-A', {
      params: {
        stageId: 'S001'
      },
      body: {
        seat: 'A区1排',
        companions: '朋友A',
        note: '隔离测试备注',
        photos: [],
        actualTicketPrice: 0
      }
    });

    const res = createResponse();
    const next = jest.fn();

    await handlers.put['/:stageId'](
      req,
      res,
      next
    );

    expect(pool.execute)
      .toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(
          'INSERT INTO stage_notes'
        ),
        [
          'user-A',
          'S001',
          'A区1排',
          '朋友A',
          '隔离测试备注',
          '[]'
        ]
      );

    expect(res.json)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          data: expect.objectContaining({
            stageId: 'S001',
            note: '隔离测试备注'
          })
        })
      );
  });
});
