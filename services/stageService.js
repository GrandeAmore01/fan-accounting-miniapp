const stages = require('../data/stages');
const storageService = require('./storageService');

const USER_ID = 'local-user';

function getYearOptions() {
  const years = Array.from(new Set(stages.map((item) => item.year))).sort((a, b) => b - a);
  return [{ id: 'all', name: '全部年份' }, ...years.map((year) => ({ id: String(year), name: `${year}年` }))];
}

function listStages() {
  const userStages = storageService.getCollection(USER_ID, 'userStages');
  return stages.map((item) => {
    const userState = userStages.find((state) => state.stageId === item.stageId);
    return {
      ...item,
      songListText: (item.songList || []).join('、'),
      songCount: (item.songList || []).length,
      albumName: item.albumId || '未关联专辑',
      isLighted: Boolean(userState && userState.isLighted),
      lightTime: userState ? userState.lightTime : ''
    };
  });
}

function filterStages(filter) {
  const keyword = (filter.keyword || '').trim();
  const year = filter.year || 'all';
  const lightStatus = filter.lightStatus || 'all';
  return listStages().filter((item) => {
    const yearMatched = year === 'all' || String(item.year) === year;
    const keywordMatched =
      !keyword ||
      item.stageName.indexOf(keyword) >= 0 ||
      item.location.indexOf(keyword) >= 0 ||
      item.songListText.indexOf(keyword) >= 0;
    const statusMatched =
      lightStatus === 'all' ||
      (lightStatus === 'lighted' && item.isLighted) ||
      (lightStatus === 'unlighted' && !item.isLighted);
    return yearMatched && keywordMatched && statusMatched;
  });
}

function setStageLighted(stageId, isLighted) {
  const userStages = storageService.getCollection(USER_ID, 'userStages');
  const exists = userStages.find((item) => item.stageId === stageId);
  if (exists) {
    exists.isLighted = isLighted;
    exists.lightTime = isLighted ? new Date().toISOString() : '';
  } else {
    userStages.push({
      userId: USER_ID,
      stageId,
      isLighted,
      lightTime: isLighted ? new Date().toISOString() : ''
    });
  }
  storageService.setCollection(USER_ID, 'userStages', userStages);
  return {
    valid: true,
    data: listStages().find((item) => item.stageId === stageId)
  };
}

function lightStage(stageId) {
  return setStageLighted(stageId, true);
}

function unlightStage(stageId) {
  return setStageLighted(stageId, false);
}

function getLightedStages() {
  return listStages().filter((item) => item.isLighted);
}

function getSongStats() {
  const songMap = {};
  getLightedStages().forEach((stage) => {
    (stage.songList || []).forEach((song) => {
      if (!songMap[song]) {
        songMap[song] = {
          songName: song,
          count: 0
        };
      }
      songMap[song].count += 1;
    });
  });
  return Object.keys(songMap)
    .map((key) => songMap[key])
    .sort((a, b) => b.count - a.count || a.songName.localeCompare(b.songName));
}

function getAlbumProgress() {
  const allAlbumMap = {};
  listStages().forEach((stage) => {
    if (!stage.albumId) {
      return;
    }
    if (!allAlbumMap[stage.albumId]) {
      allAlbumMap[stage.albumId] = {
        albumId: stage.albumId,
        total: 0,
        lightedCount: 0,
        percent: 0
      };
    }
    allAlbumMap[stage.albumId].total += 1;
    if (stage.isLighted) {
      allAlbumMap[stage.albumId].lightedCount += 1;
    }
  });
  return Object.keys(allAlbumMap).map((albumId) => {
    const item = allAlbumMap[albumId];
    return {
      ...item,
      percent: item.total > 0 ? Math.round((item.lightedCount / item.total) * 100) : 0
    };
  });
}

function getStageStats() {
  const list = listStages();
  const lightedStages = list.filter((item) => item.isLighted);
  const songStats = getSongStats();
  const progressPercent = list.length > 0 ? Math.round((lightedStages.length / list.length) * 100) : 0;
  return {
    total: list.length,
    lightedCount: lightedStages.length,
    unlockedSongCount: songStats.length,
    progressPercent
  };
}

function getStageDashboard(filter = {}) {
  return {
    stages: filterStages(filter),
    stats: getStageStats(),
    songStats: getSongStats(),
    albumProgress: getAlbumProgress()
  };
}

module.exports = {
  getYearOptions,
  listStages,
  filterStages,
  lightStage,
  unlightStage,
  getSongStats,
  getAlbumProgress,
  getStageStats,
  getStageDashboard
};
