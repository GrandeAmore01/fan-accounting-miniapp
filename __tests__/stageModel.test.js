const stageModel = require('../server/src/utils/stageModel');

describe('后端 - stageModel 基础转换工具', () => {
  test('parseJson 正确处理 JSON、对象和非法字符串', () => {
    expect(
      stageModel.parseJson('[1,2]', [])
    ).toEqual([1, 2]);

    expect(
      stageModel.parseJson({
        value: 1
      }, {})
    ).toEqual({
      value: 1
    });

    expect(
      stageModel.parseJson('invalid-json', [])
    ).toEqual([]);

    expect(
      stageModel.parseJson('', ['fallback'])
    ).toEqual(['fallback']);
  });

  test('日期字符串和 Date 对象均转换为 YYYY-MM-DD', () => {
    expect(
      stageModel.formatDateText(
        '2026-07-10T12:00:00.000Z'
      )
    ).toBe('2026-07-10');

    expect(
      stageModel.formatDateText(
        new Date(2026, 6, 10)
      )
    ).toBe('2026-07-10');

    expect(
      stageModel.formatDateText(null)
    ).toBe('');
  });
});

describe('后端 - stageModel 舞台和专辑转换', () => {
  test('rowToStage 正确组装歌曲、专辑、票档和预览字段', () => {
    const result = stageModel.rowToStage(
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
        price_tiers_json: '[580,780,1080]',
        is_online: 0,
        ticket_price: '580',
        description: '测试舞台'
      },
      [
        {
          songId: 'SONG1',
          songName: '晴天',
          albumId: 'A1'
        },
        {
          songId: 'SONG2',
          songName: '夜曲',
          albumId: 'A1'
        },
        {
          songId: 'SONG3',
          songName: '稻香',
          albumId: 'A1'
        },
        {
          songId: 'SONG4',
          songName: '花海',
          albumId: 'A1'
        }
      ],
      {
        albumId: 'A1',
        albumName: 'Album 1',
        albumNameCn: '专辑一'
      }
    );

    expect(result).toEqual(
      expect.objectContaining({
        stageId: 'S001',
        albumName: '专辑一',
        albumNameCn: '专辑一',
        priceTiers: [580, 780, 1080],
        songCount: 4,
        songListText: '晴天、夜曲、稻香、花海',
        songPreviewText: '晴天、夜曲、稻香…',
        priceTierText: '580元 / 780元 / 1080元',
        cityName: '上海',
        venueName: '上海体育场',
        stageTypeName: '演唱会'
      })
    );
  });

  test('音乐节和未关联专辑使用后备显示字段', () => {
    const result = stageModel.rowToStage({
      stage_id: 'S002',
      stage_name: '北京音乐节',
      stage_type: 'festival',
      year: 2025,
      stage_date: '2025-08-02',
      city: '',
      venue: '',
      location: '线上',
      album_id: '',
      price_tiers_json: 'invalid',
      is_online: 1,
      ticket_price: null,
      description: ''
    });

    expect(result).toEqual(
      expect.objectContaining({
        stageId: 'S002',
        location: '线上',
        albumName: '未关联专辑',
        albumNameCn: '',
        priceTiers: [],
        ticketPrice: 0,
        isOnline: true,
        cityName: '线上',
        venueName: '北京音乐节',
        stageTypeName: '音乐节/拼盘'
      })
    );
  });

  test('rowToAlbum 正确组装歌曲和歌曲总数', () => {
    expect(
      stageModel.rowToAlbum(
        {
          album_id: 'A1',
          album_name: 'Album 1',
          album_name_cn: '专辑一',
          release_year: 2020
        },
        [
          {
            song_id: 'SONG1',
            song_name: '晴天'
          },
          {
            song_id: 'SONG2',
            song_name: '夜曲'
          }
        ]
      )
    ).toEqual({
      albumId: 'A1',
      albumName: 'Album 1',
      albumNameCn: '专辑一',
      releaseYear: 2020,
      songs: [
        {
          songId: 'SONG1',
          songName: '晴天'
        },
        {
          songId: 'SONG2',
          songName: '夜曲'
        }
      ],
      totalSongCount: 2
    });
  });
});
