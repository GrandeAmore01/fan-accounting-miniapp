const mockRoutes = {
  get: {}
};

const mockRouter = {
  get: jest.fn((path, handler) => {
    mockRoutes.get[path] = handler;
  })
};

const mockPool = {
  execute: jest.fn()
};

jest.mock('express', () => ({
  Router: () => mockRouter
}), {
  virtual: true
});

jest.mock('../server/src/db', () => mockPool);

require('../server/src/routes/stages');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

const stageRows = [
  {
    stage_id: 'S001',
    stage_name: '上海演唱会',
    stage_type: 'concert',
    year: 2026,
    stage_date: '2026-07-01',
    city: '上海',
    venue: '上海体育场',
    location: '',
    album_id: 'A1',
    price_tiers_json: '[580,780]',
    is_online: 0,
    ticket_price: 580,
    description: ''
  },
  {
    stage_id: 'S002',
    stage_name: '北京音乐节',
    stage_type: 'festival',
    year: 2025,
    stage_date: '2025-08-02',
    city: '北京',
    venue: '北京公园',
    location: '',
    album_id: 'A1',
    price_tiers_json: '[380]',
    is_online: 0,
    ticket_price: 380,
    description: ''
  }
];

const stageSongRows = [
  {
    stage_id: 'S001',
    song_id: 'SONG1',
    song_name: '稻香',
    album_id: 'A1'
  },
  {
    stage_id: 'S001',
    song_id: 'SONG2',
    song_name: '夜曲',
    album_id: 'A1'
  },
  {
    stage_id: 'S002',
    song_id: 'SONG1',
    song_name: '稻香',
    album_id: 'A1'
  }
];

const albumRows = [
  {
    album_id: 'A1',
    album_name: 'Album 1',
    album_name_cn: '专辑一',
    release_year: 2020
  }
];

const allSongRows = [
  {
    song_id: 'SONG1',
    song_name: '稻香',
    album_id: 'A1'
  },
  {
    song_id: 'SONG2',
    song_name: '夜曲',
    album_id: 'A1'
  }
];

function setupBundleMock() {
  mockPool.execute
    .mockResolvedValueOnce([stageRows])
    .mockResolvedValueOnce([stageSongRows])
    .mockResolvedValueOnce([albumRows])
    .mockResolvedValueOnce([allSongRows]);
}

describe('后端 - stages 路由', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET / 组装舞台、歌曲和专辑完整数据', async () => {
    setupBundleMock();

    const req = {
      query: {}
    };
    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.get['/'](req, res, next);

    expect(mockPool.execute).toHaveBeenCalledTimes(4);

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: {
        stages: [
          expect.objectContaining({
            stageId: 'S001',
            albumName: '专辑一',
            songList: ['稻香', '夜曲'],
            songCount: 2
          }),
          expect.objectContaining({
            stageId: 'S002',
            songList: ['稻香'],
            stageTypeName: '音乐节/拼盘'
          })
        ],
        albums: [
          expect.objectContaining({
            albumId: 'A1',
            albumNameCn: '专辑一',
            totalSongCount: 2
          })
        ]
      }
    });

    expect(next).not.toHaveBeenCalled();
  });

  test('GET /search 空关键词返回空结果', async () => {
    setupBundleMock();

    const req = {
      query: {
        keyword: '   '
      }
    };
    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.get['/search'](
      req,
      res,
      next
    );

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: []
    });
  });

  test('GET /search 合并同名歌曲对应的多个舞台', async () => {
    setupBundleMock();

    const req = {
      query: {
        keyword: '稻香'
      }
    };
    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.get['/search'](
      req,
      res,
      next
    );

    expect(res.json).toHaveBeenCalledTimes(1);

    const payload = res.json.mock.calls[0][0];

    expect(payload.ok).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].songName).toBe('稻香');

    expect(
      payload.data[0].stages.map(
        (item) => item.stageId
      )
    ).toEqual([
      'S001',
      'S002'
    ]);
  });

  test('GET /albums/progress 返回专辑歌曲进度基础数据', async () => {
    mockPool.execute
      .mockResolvedValueOnce([albumRows])
      .mockResolvedValueOnce([allSongRows]);

    const req = {
      query: {}
    };
    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.get['/albums/progress'](
      req,
      res,
      next
    );

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: [
        {
          albumId: 'A1',
          albumName: 'Album 1',
          albumNameCn: '专辑一',
          releaseYear: 2020,
          songs: [
            {
              songId: 'SONG1',
              songName: '稻香'
            },
            {
              songId: 'SONG2',
              songName: '夜曲'
            }
          ],
          totalSongCount: 2
        }
      ]
    });
  });

  test('GET /:stageId 查询不到舞台时返回404', async () => {
    setupBundleMock();

    const req = {
      params: {
        stageId: 'UNKNOWN'
      },
      query: {}
    };
    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.get['/:stageId'](
      req,
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      message: '舞台场次不存在'
    });
  });

  test('数据库加载异常时交给 next 统一处理', async () => {
    const error = new Error('舞台数据库失败');

    mockPool.execute.mockRejectedValueOnce(error);

    const req = {
      query: {}
    };
    const res = createResponse();
    const next = jest.fn();

    await mockRoutes.get['/'](req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
