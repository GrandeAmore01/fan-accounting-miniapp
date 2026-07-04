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
      priceTierText: (item.priceTiers || []).map((price) => `${price}元`).join(' / '),
      cityName: item.city || item.location || '未填写城市',
      venueName: item.venue || item.stageName || '未填写场馆',
      isLighted: Boolean(userState && userState.isLighted),
      lightTime: userState ? userState.lightTime : '',
      expenseId: userState ? userState.expenseId : ''
    };
  });
}

function filterStages(filter) {
  const keyword = (filter.keyword || '').trim();
  const year = filter.year || 'all';
  const lightStatus = filter.lightStatus || 'all';
  const stageType = filter.stageType || 'all';
  return listStages().filter((item) => {
    const typeMatched = stageType === 'all' || item.stageType === stageType;
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
    return typeMatched && yearMatched && keywordMatched && statusMatched;
  });
}

function getStagesByType(stageType) {
  return listStages().filter((item) => item.stageType === stageType);
}

function getConcertStageOptions() {
  return getStagesByType('concert').map((item) => ({
    id: item.stageId,
    name: `${item.date} ${item.stageName}`,
    date: item.date,
    stageName: item.stageName,
    priceTiers: item.priceTiers || []
  }));
}

function findStageByDate(date, stageType = 'concert') {
  return listStages().find((item) => item.stageType === stageType && item.date === date);
}

function parseDateValue(dateText) {
  if (!dateText) {
    return null;
  }
  const [year, month, day] = dateText.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDisplayDate(dateText) {
  return dateText ? dateText.replace(/-/g, '.') : '暂无记录';
}

function diffDays(fromDate, toDate) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((toDate.getTime() - fromDate.getTime()) / oneDay);
}

function buildMeetItem(stage, days) {
  if (!stage) {
    return {
      daysText: '--',
      dateText: '暂无记录',
      stageName: ''
    };
  }
  return {
    daysText: String(days),
    dateText: formatDisplayDate(stage.date),
    stageName: stage.stageName
  };
}

function getMeetTimeline() {
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const meetStages = listStages()
    .filter((item) => item.stageType === 'concert' || item.stageType === 'festival')
    .filter((item) => item.isLighted)
    .filter((item) => parseDateValue(item.date))
    .sort((a, b) => parseDateValue(a.date).getTime() - parseDateValue(b.date).getTime());

  const pastStages = meetStages.filter((item) => parseDateValue(item.date).getTime() <= todayDate.getTime());
  const futureStages = meetStages.filter((item) => parseDateValue(item.date).getTime() > todayDate.getTime());
  const lastMeet = pastStages[pastStages.length - 1];
  const nextMeet = futureStages[0];
  const firstMeet = meetStages[0];

  return {
    hasMeetStages: meetStages.length > 0,
    lastMeet: buildMeetItem(
      lastMeet,
      lastMeet ? diffDays(parseDateValue(lastMeet.date), todayDate) : 0
    ),
    nextMeet: buildMeetItem(
      nextMeet,
      nextMeet ? diffDays(todayDate, parseDateValue(nextMeet.date)) : 0
    ),
    firstMeetDateText: firstMeet ? formatDisplayDate(firstMeet.date) : '暂无记录'
  };
}

function sortRankItems(items) {
  return items.sort((a, b) => b.count - a.count || b.latestDate.localeCompare(a.latestDate));
}

function buildRankMap(stagesList, fieldName) {
  const rankMap = {};
  stagesList.forEach((stage) => {
    const name = stage[fieldName] || '未填写';
    if (!rankMap[name]) {
      rankMap[name] = {
        name,
        count: 0,
        latestDate: '',
        earliestDate: ''
      };
    }
    rankMap[name].count += 1;
    if (!rankMap[name].latestDate || stage.date > rankMap[name].latestDate) {
      rankMap[name].latestDate = stage.date;
    }
    if (!rankMap[name].earliestDate || stage.date < rankMap[name].earliestDate) {
      rankMap[name].earliestDate = stage.date;
    }
  });
  return sortRankItems(Object.keys(rankMap).map((key) => rankMap[key])).map((item, index) => ({
    ...item,
    rank: index + 1
  }));
}

function getMeetMemoryReport(stageType = 'concert') {
  const typeName = stageType === 'festival' ? '音乐节/拼盘' : '演唱会';
  const lightedMeetStages = listStages()
    .filter((item) => item.isLighted)
    .filter((item) => item.stageType === stageType)
    .filter((item) => parseDateValue(item.date))
    .sort((a, b) => parseDateValue(a.date).getTime() - parseDateValue(b.date).getTime());

  const enrichedStages = lightedMeetStages.map((item) => ({
    ...item,
    cityName: item.cityName || item.city || item.location || '未填写城市',
    venueName: item.venueName || item.venue || item.stageName || '未填写场馆'
  }));
  const cityRanking = buildRankMap(enrichedStages, 'cityName');
  const venueRanking = buildRankMap(enrichedStages, 'venueName');
  const firstStage = enrichedStages[0];
  const latestStage = enrichedStages[enrichedStages.length - 1];
  const topCity = cityRanking[0] || { name: '暂无记录', count: 0 };
  const topVenue = venueRanking[0] || { name: '暂无记录', count: 0 };

  return {
    stageType,
    typeName,
    hasRecords: enrichedStages.length > 0,
    meetCount: enrichedStages.length,
    cityCount: cityRanking.length,
    venueCount: venueRanking.length,
    topCity,
    topVenue,
    firstVenueName: firstStage ? firstStage.venueName : '暂无记录',
    firstCityName: firstStage ? firstStage.cityName : '暂无记录',
    earliestDateText: firstStage ? formatDisplayDate(firstStage.date) : '暂无记录',
    latestDateText: latestStage ? formatDisplayDate(latestStage.date) : '暂无记录',
    cityRanking,
    venueRanking
  };
}

function setStageLighted(stageId, isLighted, options = {}) {
  const userStages = storageService.getCollection(USER_ID, 'userStages');
  const exists = userStages.find((item) => item.stageId === stageId);
  if (exists) {
    if (!isLighted && options.deleteExpense && exists.expenseId) {
      const expenseService = require('./expenseService');
      expenseService.removeExpense(exists.expenseId);
      exists.expenseId = '';
    }
    exists.isLighted = isLighted;
    exists.lightTime = isLighted ? new Date().toISOString() : '';
  } else {
    userStages.push({
      userId: USER_ID,
      stageId,
      isLighted,
      lightTime: isLighted ? new Date().toISOString() : '',
      expenseId: ''
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

function unlightStage(stageId, options = {}) {
  return setStageLighted(stageId, false, options);
}

function getStageById(stageId) {
  return stages.find((item) => item.stageId === stageId);
}

function createExpenseFromStage(stageId, priceTier) {
  const expenseService = require('./expenseService');
  const stage = getStageById(stageId);
  if (!stage) {
    return { valid: false, message: '舞台场次不存在' };
  }
  const price = Number(priceTier || (stage.priceTiers || [])[0] || 0);
  const expenseResult = expenseService.addExpense({
    category: 'meet',
    subType: stage.stageType === 'festival' ? 'festival' : 'concert',
    itemName: stage.stageName,
    amount: price,
    quantity: 1,
    date: stage.date,
    paymentMethod: '微信支付',
    location: stage.location || '',
    remark: '由舞台记录点亮同步生成',
    includeInTotal: true,
    stageId: stage.stageId,
    stageDate: stage.date,
    priceTier: price
  });
  if (!expenseResult.valid) {
    return expenseResult;
  }

  const userStages = storageService.getCollection(USER_ID, 'userStages');
  const exists = userStages.find((item) => item.stageId === stageId);
  if (exists) {
    exists.expenseId = expenseResult.data.expenseId;
  }
  storageService.setCollection(USER_ID, 'userStages', userStages);
  return {
    valid: true,
    data: expenseResult.data
  };
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
    meetTimeline: getMeetTimeline(),
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
  getStagesByType,
  getConcertStageOptions,
  findStageByDate,
  lightStage,
  unlightStage,
  createExpenseFromStage,
  getMeetTimeline,
  getMeetMemoryReport,
  getSongStats,
  getAlbumProgress,
  getStageStats,
  getStageDashboard
};
