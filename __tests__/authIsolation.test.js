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

function createRequest(token, query = {}, body = {}) {
  return {
    query: { ...query },
    body: { ...body },
    get: jest.fn((name) => {
      if (String(name).toLowerCase() === 'authorization') {
        return token ? `Bearer ${token}` : '';
      }
      return '';
    })
  };
}

describe('后端认证与用户隔离', () => {
  test('有效令牌覆盖查询参数和请求体中的伪造userId', () => {
    const token = createToken('user-A');

    const req = createRequest(
      token,
      { userId: 'attacker-query' },
      { userId: 'attacker-body', itemName: '测试记录' }
    );

    const res = createResponse();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.auth.userId).toBe('user-A');
    expect(req.query.userId).toBe('user-A');
    expect(req.body.userId).toBe('user-A');
    expect(req.body.itemName).toBe('测试记录');
    expect(res.status).not.toHaveBeenCalled();
  });

  test('用户A和用户B的令牌解析为不同身份', () => {
    const reqA = createRequest(
      createToken('user-A'),
      { userId: 'forged' },
      {}
    );

    const reqB = createRequest(
      createToken('user-B'),
      { userId: 'forged' },
      {}
    );

    requireAuth(reqA, createResponse(), jest.fn());
    requireAuth(reqB, createResponse(), jest.fn());

    expect(reqA.auth.userId).toBe('user-A');
    expect(reqB.auth.userId).toBe('user-B');
    expect(reqA.query.userId)
      .not.toBe(reqB.query.userId);
  });

  test('无效令牌返回401且不进入业务路由', () => {
    const req = createRequest('invalid-token');
    const res = createResponse();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      message: '登录状态无效，请重新进入小程序'
    });
  });

  test('过期令牌返回401且不进入业务路由', () => {
    jest.useFakeTimers();

    try {
      const start = new Date('2026-07-12T00:00:00Z');
      jest.setSystemTime(start);

      const token = createToken('expired-user');

      jest.setSystemTime(
        new Date(
          start.getTime() +
          31 * 24 * 60 * 60 * 1000
        )
      );

      const req = createRequest(token);
      const res = createResponse();
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    } finally {
      jest.useRealTimers();
    }
  });
});
