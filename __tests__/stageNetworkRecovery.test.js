function createStage(stageId, stageName = '真实云端场次') {
  return {
    stageId,
    stageName,
    stageType: 'concert',
    year: 2026,
    date: '2026-07-20',
    city: '上海',
    venue: '上海体育场',
    location: '上海体育场',
    albumId: 'ALBUM-1',
    albumName: '测试专辑',
    albumNameCn: '测试专辑',
    songList: ['测试歌曲'],
    songs: [
      {
        songId: `${stageId}-song-1`,
        songName: '测试歌曲',
        albumId: 'ALBUM-1'
      }
    ],
    priceTiers: [580],
    ticketPrice: 580
  };
}

function createStagePayload(
  stageId = 'CLOUD-S001',
  stageName = '真实云端场次'
) {
  return {
    stages: [
      createStage(stageId, stageName)
    ],
    albums: []
  };
}

function createHarness(options = {}) {
  jest.resetModules();

  const localState = {
    userStages: (
      options.localUserStages || []
    ).map((item) => ({ ...item })),

    stageNotes: (
      options.localStageNotes || []
    ).map((item) => ({ ...item }))
  };

  const mockStorageService = {
    getCollection: jest.fn(
      (userId, collectionName) => (
        localState[collectionName] || []
      ).map((item) => ({ ...item }))
    ),

    setCollection: jest.fn(
      (userId, collectionName, value) => {
        localState[collectionName] = (
          value || []
        ).map((item) => ({ ...item }));

        return value;
      }
    )
  };

  const mockApiService = {
    request: jest.fn(),

    buildQuery: jest.fn((params = {}) => {
      const query = Object.entries(params)
        .map(
          ([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
        )
        .join('&');

      return query ? `?${query}` : '';
    })
  };

  const mockExpenseService = {
    listExpenses: jest.fn(() => []),
    listExpensesAsync: jest.fn(
      async () => []
    ),
    addExpense: jest.fn(),
    addExpenseAsync: jest.fn(),
    removeExpense: jest.fn(),
    removeExpenseAsync: jest.fn()
  };

  const mockConfig = {
    userId: 'test-user',
    useBackend: true,
    useStageBackend: true,
    apiBaseUrl: '/api',
    stageApiBaseUrl: '/api'
  };

  jest.doMock(
    '../services/apiService',
    () => mockApiService
  );

  jest.doMock(
    '../services/config',
    () => mockConfig
  );

  jest.doMock(
    '../services/storageService',
    () => mockStorageService
  );

  jest.doMock(
    '../services/expenseService',
    () => mockExpenseService
  );

  const stageService =
    require('../services/stageService');

  return {
    stageService,
    mockApiService,
    mockStorageService,
    mockExpenseService,
    localState
  };
}

function installSuccessfulApi(
  mockApiService,
  payload = createStagePayload(),
  userStages = [],
  stageNotes = []
) {
  mockApiService.request.mockImplementation(
    async (options) => {
      if (options.url === '/stages') {
        return payload;
      }

      if (
        options.url.startsWith(
          '/user-stages'
        )
      ) {
        return userStages;
      }

      if (
        options.url.startsWith(
          '/stage-notes'
        )
      ) {
        return stageNotes;
      }

      throw new Error(
        `未处理的测试接口：${options.url}`
      );
    }
  );
}

function getRealStages(stageService) {
  return stageService
    .listStages()
    .filter(
      (item) =>
        !item.isCountdownPlaceholder
    );
}

function countStageCatalogRequests(
  mockApiService
) {
  return mockApiService.request.mock.calls
    .filter(
      ([options]) =>
        options.url === '/stages'
    )
    .length;
}

describe(
  'DEF-NET-108 舞台弱网与缓存恢复',
  () => {
    let warnSpy;

    beforeEach(() => {
      warnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    test(
      '首次云端加载失败时不展示本地示例场次且不污染缓存',
      async () => {
        const {
          stageService,
          mockApiService,
          mockStorageService
        } = createHarness();

        mockApiService.request
          .mockRejectedValue(
            new Error('network timeout')
          );

        await expect(
          stageService.ensureStagesLoaded()
        ).rejects.toThrow(
          'network timeout'
        );

        expect(
          getRealStages(stageService)
        ).toEqual([]);

        expect(
          stageService.listStages()
        ).toEqual([]);

        expect(
          mockStorageService.setCollection
        ).not.toHaveBeenCalled();
      }
    );

    test(
      '首次失败后再次进入会重新请求云端并恢复真实场次',
      async () => {
        const {
          stageService,
          mockApiService
        } = createHarness();

        let catalogAttempt = 0;

        mockApiService.request
          .mockImplementation(
            async (options) => {
              if (
                options.url === '/stages'
              ) {
                catalogAttempt += 1;

                if (catalogAttempt === 1) {
                  throw new Error(
                    'first timeout'
                  );
                }

                return createStagePayload(
                  'CLOUD-RECOVERED',
                  '网络恢复后的真实场次'
                );
              }

              if (
                options.url.startsWith(
                  '/user-stages'
                ) ||
                options.url.startsWith(
                  '/stage-notes'
                )
              ) {
                return [];
              }

              throw new Error(
                `未处理接口：${options.url}`
              );
            }
          );

        await expect(
          stageService.ensureStagesLoaded()
        ).rejects.toThrow(
          'first timeout'
        );

        await expect(
          stageService.ensureStagesLoaded()
        ).resolves.toEqual(
          expect.any(Array)
        );

        expect(
          countStageCatalogRequests(
            mockApiService
          )
        ).toBe(2);

        expect(
          getRealStages(stageService)
            .map((item) => item.stageId)
        ).toEqual([
          'CLOUD-RECOVERED'
        ]);
      }
    );

    test(
      '并发进入舞台页面时只发起一次目录请求',
      async () => {
        const {
          stageService,
          mockApiService
        } = createHarness();

        let resolveCatalog;

        const pendingCatalog =
          new Promise((resolve) => {
            resolveCatalog = resolve;
          });

        mockApiService.request
          .mockImplementation(
            async (options) => {
              if (
                options.url === '/stages'
              ) {
                return pendingCatalog;
              }

              if (
                options.url.startsWith(
                  '/user-stages'
                ) ||
                options.url.startsWith(
                  '/stage-notes'
                )
              ) {
                return [];
              }

              throw new Error(
                `未处理接口：${options.url}`
              );
            }
          );

        const firstPromise =
          stageService.ensureStagesLoaded();

        const secondPromise =
          stageService.ensureStagesLoaded();

        expect(firstPromise)
          .toBe(secondPromise);

        expect(
          countStageCatalogRequests(
            mockApiService
          )
        ).toBe(1);

        resolveCatalog(
          createStagePayload(
            'CLOUD-CONCURRENT'
          )
        );

        await Promise.all([
          firstPromise,
          secondPromise
        ]);

        expect(
          countStageCatalogRequests(
            mockApiService
          )
        ).toBe(1);
      }
    );

    test(
      '真实云端目录加载成功后普通重复进入不重复下载目录',
      async () => {
        const {
          stageService,
          mockApiService
        } = createHarness();

        installSuccessfulApi(
          mockApiService,
          createStagePayload(
            'CLOUD-CACHED'
          )
        );

        await stageService
          .ensureStagesLoaded();

        await stageService
          .ensureStagesLoaded();

        expect(
          countStageCatalogRequests(
            mockApiService
          )
        ).toBe(1);

        expect(
          getRealStages(stageService)[0]
            .stageId
        ).toBe('CLOUD-CACHED');
      }
    );

    test(
      '已有真实云端目录时强制刷新失败不会改成示例数据',
      async () => {
        const {
          stageService,
          mockApiService
        } = createHarness();

        let catalogAttempt = 0;

        mockApiService.request
          .mockImplementation(
            async (options) => {
              if (
                options.url === '/stages'
              ) {
                catalogAttempt += 1;

                if (catalogAttempt === 1) {
                  return createStagePayload(
                    'CLOUD-VALID',
                    '已缓存真实场次'
                  );
                }

                throw new Error(
                  'refresh timeout'
                );
              }

              if (
                options.url.startsWith(
                  '/user-stages'
                ) ||
                options.url.startsWith(
                  '/stage-notes'
                )
              ) {
                return [];
              }

              throw new Error(
                `未处理接口：${options.url}`
              );
            }
          );

        await stageService
          .ensureStagesLoaded();

        await expect(
          stageService.ensureStagesLoaded({
            force: true
          })
        ).rejects.toThrow(
          'refresh timeout'
        );

        const realStages =
          getRealStages(stageService);

        expect(realStages)
          .toHaveLength(1);

        expect(realStages[0].stageId)
          .toBe('CLOUD-VALID');
      }
    );

    test(
      '舞台用户状态接口失败时回退当前用户的本地缓存',
      async () => {
        const {
          stageService,
          mockApiService
        } = createHarness({
          localUserStages: [
            {
              stageId: 'CLOUD-LOCAL-STATE',
              isLighted: true,
              lightTime:
                '2026-07-01T10:00:00.000Z',
              expenseId: '',
              actualTicketPrice: 580
            }
          ],

          localStageNotes: [
            {
              stageId: 'CLOUD-LOCAL-STATE',
              seat: 'A区1排',
              companions: '朋友A',
              note: '本地缓存备注'
            }
          ]
        });

        mockApiService.request
          .mockImplementation(
            async (options) => {
              if (
                options.url === '/stages'
              ) {
                return createStagePayload(
                  'CLOUD-LOCAL-STATE'
                );
              }

              if (
                options.url.startsWith(
                  '/user-stages'
                ) ||
                options.url.startsWith(
                  '/stage-notes'
                )
              ) {
                throw new Error(
                  'user state timeout'
                );
              }

              throw new Error(
                `未处理接口：${options.url}`
              );
            }
          );

        await expect(
          stageService.ensureStagesLoaded()
        ).resolves.toEqual(
          expect.any(Array)
        );

        const stage =
          getRealStages(stageService)[0];

        expect(stage.isLighted)
          .toBe(true);

        expect(stage.actualTicketPrice)
          .toBeUndefined();

        expect(
          stageService.getStageNote(
            'CLOUD-LOCAL-STATE'
          )
        ).toEqual(
          expect.objectContaining({
            seat: 'A区1排',
            companions: '朋友A',
            note: '本地缓存备注',
            actualTicketPrice: 580
          })
        );
      }
    );

    test(
      '云端用户状态成功后覆盖旧状态并写入当前用户缓存',
      async () => {
        const {
          stageService,
          mockApiService,
          mockStorageService
        } = createHarness({
          localUserStages: [
            {
              stageId: 'CLOUD-STATE',
              isLighted: false
            }
          ]
        });

        const cloudUserStages = [
          {
            stageId: 'CLOUD-STATE',
            isLighted: true,
            lightTime:
              '2026-07-02T10:00:00.000Z',
            expenseId: 'EXP-001',
            actualTicketPrice: 680
          }
        ];

        const cloudStageNotes = [
          {
            stageId: 'CLOUD-STATE',
            seat: 'B区2排',
            companions: '朋友B',
            note: '云端备注'
          }
        ];

        installSuccessfulApi(
          mockApiService,
          createStagePayload(
            'CLOUD-STATE'
          ),
          cloudUserStages,
          cloudStageNotes
        );

        await stageService
          .ensureStagesLoaded();

        const stage =
          getRealStages(stageService)[0];

        expect(stage.isLighted)
          .toBe(true);

        expect(stage.expenseId)
          .toBe('EXP-001');

        expect(
          mockStorageService.setCollection
        ).toHaveBeenCalledWith(
          'test-user',
          'userStages',
          cloudUserStages
        );

        expect(
          mockStorageService.setCollection
        ).toHaveBeenCalledWith(
          'test-user',
          'stageNotes',
          cloudStageNotes
        );

        expect(
          stageService.getStageNote(
            'CLOUD-STATE'
          )
        ).toEqual(
          expect.objectContaining({
            seat: 'B区2排',
            note: '云端备注',
            actualTicketPrice: 680
          })
        );
      }
    );

    test(
      '主动失效缓存后会重新下载并替换旧舞台目录',
      async () => {
        const {
          stageService,
          mockApiService
        } = createHarness();

        let catalogAttempt = 0;

        mockApiService.request
          .mockImplementation(
            async (options) => {
              if (
                options.url === '/stages'
              ) {
                catalogAttempt += 1;

                return catalogAttempt === 1
                  ? createStagePayload(
                      'CLOUD-OLD',
                      '旧云端目录'
                    )
                  : createStagePayload(
                      'CLOUD-NEW',
                      '新云端目录'
                    );
              }

              if (
                options.url.startsWith(
                  '/user-stages'
                ) ||
                options.url.startsWith(
                  '/stage-notes'
                )
              ) {
                return [];
              }

              throw new Error(
                `未处理接口：${options.url}`
              );
            }
          );

        await stageService
          .ensureStagesLoaded();

        expect(
          getRealStages(stageService)
            .map((item) => item.stageId)
        ).toEqual(['CLOUD-OLD']);

        stageService
          .invalidateStageCache();

        await stageService
          .ensureStagesLoaded();

        expect(
          countStageCatalogRequests(
            mockApiService
          )
        ).toBe(2);

        expect(
          getRealStages(stageService)
            .map((item) => item.stageId)
        ).toEqual(['CLOUD-NEW']);
      }
    );
  }
);
